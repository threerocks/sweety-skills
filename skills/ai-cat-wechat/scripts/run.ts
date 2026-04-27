import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Jimp, JimpMime, HorizontalAlign, VerticalAlign, loadFont } from "../../sweety-post-to-wechat/scripts/node_modules/jimp";
import { loadCourseSourcePack, resolveLessonPack } from "./course-pack.ts";
import { ensureAiCatDataDir, loadCatalogs, loadHotCaseHistory, loadRunHistory, loadTrackState, saveHotCaseHistory, saveRunHistory, saveTrackState } from "./store.ts";
import { loadAiCatConfig, slotToTrack } from "./config.ts";
import type {
  CatalogItem,
  CourseCatalog,
  CourseSourcePack,
  EvidenceSource,
  HotCaseHistoryEntry,
  HotCaseItem,
  LessonContentPack,
  NewsItem,
  RunHistoryEntry,
  RunManifest,
  Slot,
  Track,
  WorkType,
} from "./types.ts";

const KNOWN_IMAGE_PROVIDERS = new Set(["google", "relay", "dashscope", "openai", "openrouter", "replicate", "jimeng", "seedream"]);

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseSlot(value: string | undefined): Slot | undefined {
  if (value === "kids" || value === "adult" || value === "evening" || value === "news") return value;
  return undefined;
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 80);
}

function nowDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateStamp(date: string): string {
  return date.replace(/-/g, "");
}

function chooseCourse(catalogs: CourseCatalog[], track: Track, completedIds: string[]): CourseCatalog | null {
  const validated = catalogs
    .filter((item) => item.track === track && item.status === "validated" && !completedIds.includes(item.course_id))
    .sort((a, b) => a.priority - b.priority || Number(Boolean(a.evergreen)) - Number(Boolean(b.evergreen)));
  if (validated.length > 0) return validated[0]!;
  return catalogs
    .filter((item) => item.track === track && item.status === "validated" && item.evergreen)
    .sort((a, b) => a.priority - b.priority)[0] || null;
}

function ensureCourseAssigned(track: Track, catalogs: CourseCatalog[], state: ReturnType<typeof loadTrackState>): CourseCatalog | null {
  const cursor = state.tracks[track];
  let current = cursor.current_course_id
    ? catalogs.find((item) => item.course_id === cursor.current_course_id && item.track === track && item.status === "validated") || null
    : null;

  if (current && cursor.current_item_index >= current.catalog_items.length) {
    cursor.completed_course_ids.push(current.course_id);
    cursor.current_course_id = null;
    cursor.current_item_index = 0;
    current = null;
  }

  if (!current) {
    const next = chooseCourse(catalogs, track, cursor.completed_course_ids);
    if (!next) {
      cursor.status = "blocked";
      return null;
    }
    cursor.current_course_id = next.course_id;
    cursor.current_item_index = 0;
    cursor.status = "ready";
    current = next;
  }

  return current;
}

function decideWorkType(item: CatalogItem, preferred?: WorkType): WorkType {
  if (preferred) return preferred;
  if (item.default_work_type === "article") return "article";
  if (item.required_source_types.length >= 4 || item.core_question.length > 42) return "article";
  return "poster";
}

function loadJsonArray<T>(filePath: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T[];
  } catch {
    return [];
  }
}

function fileOrUrlItems<T>(filePathOrUrl?: string): Promise<T[]> | T[] {
  if (!filePathOrUrl) return [];
  if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
    return fetch(filePathOrUrl).then(async (response) => {
      if (!response.ok) throw new Error(`failed to fetch ${filePathOrUrl}: ${response.status}`);
      return await response.json() as T[];
    });
  }
  return loadJsonArray<T>(path.resolve(filePathOrUrl));
}

function isWithinHours(publishedAt: string, hours: number): boolean {
  const timestamp = new Date(publishedAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function selectHotCase(items: HotCaseItem[], minScore: number, history: HotCaseHistoryEntry[]): HotCaseItem | null {
  const recentIds = new Set(history.slice(-10).map((item) => item.hot_case_id));
  return items
    .filter((item) => item.is_practical && item.score >= minScore)
    .filter((item) => isWithinHours(item.published_at, 24))
    .filter((item) => !recentIds.has(item.id))
    .sort((a, b) => b.score - a.score || new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0] || null;
}

function selectNewsItems(items: NewsItem[], maxItems: number, minItems: number, lookbackHours: number): NewsItem[] {
  const selected = items
    .filter((item) => isWithinHours(item.published_at, lookbackHours))
    .sort((a, b) => b.score - a.score || new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, maxItems);
  if (selected.length < minItems) return [];
  return selected;
}

function themeColor(slot: Slot): number {
  switch (slot) {
    case "kids": return 0xf6b73cFF;
    case "adult": return 0x1f5effFF;
    case "evening": return 0x122033FF;
    case "news": return 0x177245FF;
  }
}

function fontFile(name: string): string {
  return pathToFileURL(path.resolve(
    process.cwd(),
    "skills/sweety-post-to-wechat/scripts/node_modules/@jimp/plugin-print/fonts/open-sans",
    name,
    `${name}.fnt`,
  )).href;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function cleanList(values: string[] | undefined, fallback: string[] = []): string[] {
  return uniqueStrings([...(values || []), ...fallback]);
}

async function createTextImage(title: string, subtitle: string, outputPath: string, slot: Slot, width: number, height: number): Promise<void> {
  const background = new Jimp({ width, height, color: themeColor(slot) });
  const font = await loadFont(fontFile("open-sans-32-white"));
  const smallFont = await loadFont(fontFile("open-sans-16-white"));
  background.print({
    font,
    x: 60,
    y: 120,
    text: {
      text: title,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 120,
    maxHeight: height - 220,
  });
  background.print({
    font: smallFont,
    x: 60,
    y: height - 120,
    text: {
      text: subtitle,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.BOTTOM,
    },
    maxWidth: width - 120,
    maxHeight: 80,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.writeFileSync(outputPath, buffer);
}

async function createStructuredPosterImage(title: string, lesson: LessonContentPack, outputPath: string, slot: Slot): Promise<void> {
  const width = 1080;
  const height = 1440;
  const background = new Jimp({ width, height, color: themeColor(slot) });
  const card = new Jimp({ width: width - 120, height: height - 260, color: 0xfff8edff });
  const titleFont = await loadFont(fontFile("open-sans-32-black"));
  const bodyFont = await loadFont(fontFile("open-sans-16-black"));
  const smallFont = await loadFont(fontFile("open-sans-14-black"));
  const points = cleanList(lesson.poster_points, lesson.takeaways).slice(0, 3);
  const evidence = cleanList(lesson.evidence.map((entry) => entry.source_label)).slice(0, 2);

  background.composite(card, 60, 120);
  background.print({
    font: titleFont,
    x: 110,
    y: 170,
    text: {
      text: title,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 220,
    maxHeight: 180,
  });
  background.print({
    font: bodyFont,
    x: 110,
    y: 330,
    text: {
      text: lesson.big_idea || lesson.summary,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 220,
    maxHeight: 180,
  });

  points.forEach((point, index) => {
    const top = 560 + index * 180;
    const panel = new Jimp({ width: width - 220, height: 120, color: 0xffffffff });
    background.composite(panel, 110, top);
    background.print({
      font: titleFont,
      x: 140,
      y: top + 24,
      text: {
        text: `0${index + 1}`,
        alignmentX: HorizontalAlign.LEFT,
        alignmentY: VerticalAlign.TOP,
      },
      maxWidth: 70,
      maxHeight: 50,
    });
    background.print({
      font: bodyFont,
      x: 230,
      y: top + 30,
      text: {
        text: point,
        alignmentX: HorizontalAlign.LEFT,
        alignmentY: VerticalAlign.TOP,
      },
      maxWidth: width - 360,
      maxHeight: 70,
    });
  });

  background.print({
    font: smallFont,
    x: 110,
    y: height - 160,
    text: {
      text: evidence.length > 0 ? `资料支撑：${evidence.join("、")}` : "资料支撑：课程包研究材料",
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 220,
    maxHeight: 50,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.writeFileSync(outputPath, buffer);
}

async function createStructuredInlineImage(title: string, lesson: LessonContentPack, outputPath: string, slot: Slot): Promise<void> {
  const width = 1080;
  const height = 1440;
  const background = new Jimp({ width, height, color: 0xfffcf7ff });
  const header = new Jimp({ width, height: 250, color: themeColor(slot) });
  const titleFont = await loadFont(fontFile("open-sans-32-white"));
  const bodyFont = await loadFont(fontFile("open-sans-16-black"));
  const subFont = await loadFont(fontFile("open-sans-14-black"));
  background.composite(header, 0, 0);
  background.print({
    font: titleFont,
    x: 70,
    y: 70,
    text: {
      text: title,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 140,
    maxHeight: 120,
  });
  background.print({
    font: bodyFont,
    x: 70,
    y: 320,
    text: {
      text: lesson.opening_scene || lesson.summary,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: width - 140,
    maxHeight: 260,
  });
  cleanList(lesson.takeaways).slice(0, 3).forEach((point, index) => {
    background.print({
      font: subFont,
      x: 70,
      y: 640 + index * 110,
      text: {
        text: `${index + 1}. ${point}`,
        alignmentX: HorizontalAlign.LEFT,
        alignmentY: VerticalAlign.TOP,
      },
      maxWidth: width - 140,
      maxHeight: 90,
    });
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.writeFileSync(outputPath, buffer);
}

function buildPosterMarkdown(title: string, summary: string, item: CatalogItem, posterRelativePath: string): string {
  const teachingPoints = item.teaching_points?.slice(0, 3) || [];
  return [
    `# ${title}`,
    "",
    summary,
    "",
    `![本讲贴图](${posterRelativePath})`,
    "",
    `${title} 这一讲先回答 ${item.core_question}。为了让读者更容易记住内容，正文会先把问题放到真实场景里，再解释这个章节最关键的判断依据。`,
    "",
    teachingPoints.length > 0
      ? `本讲重点会围绕 ${teachingPoints.join("、")} 展开，读完以后应该能把概念、步骤和边界连成一条线。`
      : `本讲重点会围绕 ${item.seed_keywords.join("、")} 展开，读完以后应该能把概念、步骤和边界连成一条线。`,
    "",
    `知识支撑优先采用 ${item.required_source_types.join("、")}，避免把课程章节写成空泛摘要。`,
    "",
  ].join("\n");
}

function buildArticleMarkdown(title: string, summary: string, item: CatalogItem, coverRelativePath: string, inlineRelativePath: string): string {
  const notes = item.source_notes?.slice(0, 3) || [];
  return [
    "---",
    `title: ${title}`,
    `summary: ${summary}`,
    `coverImage: ${coverRelativePath}`,
    "---",
    "",
    `# ${title}`,
    "",
    summary,
    "",
    `![本讲主图](${inlineRelativePath})`,
    "",
    "## 这一讲要解决的问题",
    "",
    `${item.core_question} 这就是这一讲的中心问题。正文会按场景、方法和边界三个层次往下展开，尽量让内容既能落地，也能跟前一讲和后一讲接上。`,
    "",
    "## 为什么这一讲要放在这里",
    "",
    `这节内容放在当前课程序列里，不只是为了补一个知识点，更是为了把 ${item.seed_keywords.join("、")} 这些概念连接起来，让读者知道这一讲和整个系列的前后关系。`,
    "",
    "## 本讲的阅读抓手",
    "",
    notes.length > 0
      ? notes.map((note) => `${note}。`).join("\n\n")
      : `建议先看图建立整体印象，再回到文字理解 ${item.required_source_types.join("、")} 如何共同支撑这节内容的判断。`,
    "",
    "## 结尾提醒",
    "",
    "真正适合公众号长期连载的内容，不只是把结论放出来，而是要让每一讲都能自然接住上一讲，也能为下一讲留下过渡。",
    "",
  ].join("\n");
}

function buildLessonPosterMarkdown(title: string, summary: string, lesson: LessonContentPack, posterRelativePath: string): string {
  const takeaways = cleanList(lesson.takeaways).slice(0, 3);
  const sources = lesson.evidence.slice(0, 3).map((entry) => `${entry.source_label}：${entry.source_title}`);
  return [
    `# ${title}`,
    "",
    summary,
    "",
    `![本讲贴图](${posterRelativePath})`,
    "",
    "先把画面里的重点记住：",
    "",
    lesson.opening_scene,
    "",
    lesson.big_idea,
    "",
    ...(takeaways.length > 0 ? [
      "这一讲最重要的三句话：",
      "",
      ...takeaways.map((point, index) => `${index + 1}. ${point}`),
      "",
    ] : []),
    ...(lesson.at_home_try && lesson.at_home_try.length > 0 ? [
      "回到家里可以直接试这两步：",
      "",
      ...lesson.at_home_try.slice(0, 2).map((step, index) => `${index + 1}. ${step}`),
      "",
    ] : []),
    ...(sources.length > 0 ? [
      "这一讲主要参考：",
      "",
      ...sources.map((entry) => `- ${entry}`),
      "",
    ] : []),
  ].join("\n");
}

function buildLessonArticleMarkdown(title: string, summary: string, lesson: LessonContentPack, coverRelativePath: string, inlineRelativePath: string): string {
  const takeaways = cleanList(lesson.takeaways).slice(0, 3);
  const misconceptions = cleanList(lesson.misconceptions).slice(0, 2);
  const discussionQuestions = cleanList(lesson.discussion_questions).slice(0, 2);
  return [
    "---",
    `title: ${title}`,
    `summary: ${summary}`,
    `coverImage: ${coverRelativePath}`,
    "---",
    "",
    `# ${title}`,
    "",
    summary,
    "",
    `![本讲主图](${inlineRelativePath})`,
    "",
    "## 先从一个场景开始",
    "",
    lesson.opening_scene,
    "",
    "## 这一讲真正想讲明白什么",
    "",
    lesson.big_idea,
    "",
    ...lesson.explanation_sections.flatMap((section) => [
      `## ${section.heading}`,
      "",
      section.body,
      "",
    ]),
    ...(takeaways.length > 0 ? [
      "## 读完先记住",
      "",
      ...takeaways.map((point, index) => `${index + 1}. ${point}`),
      "",
    ] : []),
    ...(misconceptions.length > 0 ? [
      "## 最容易踩的两个误会",
      "",
      ...misconceptions.map((point, index) => `${index + 1}. ${point}`),
      "",
    ] : []),
    ...(discussionQuestions.length > 0 ? [
      "## 留给孩子的两个小问题",
      "",
      ...discussionQuestions.map((question, index) => `${index + 1}. ${question}`),
      "",
    ] : []),
    ...(lesson.evidence.length > 0 ? [
      "## 这一讲的资料支撑",
      "",
      ...lesson.evidence.slice(0, 4).map((source) => `- ${source.source_label}｜${source.source_title}｜${source.source_url}`),
      "",
    ] : []),
  ].join("\n");
}

function buildResearchBrief(course: CourseCatalog, item: CatalogItem, lesson: LessonContentPack | null, pack: CourseSourcePack | null): Record<string, unknown> {
  return {
    course_id: course.course_id,
    course_title: course.course_title,
    item_no: item.item_no,
    item_title: item.title,
    core_question: item.core_question,
    seed_keywords: item.seed_keywords,
    required_source_types: item.required_source_types,
    teaching_points: item.teaching_points || [],
    source_notes: item.source_notes || [],
    catalog_source_url: course.catalog_source_url,
    provider: course.provider,
    catalog_overview: pack?.catalog_overview || null,
    catalog_source_documents: pack?.catalog_source_documents || [],
    lesson_summary: lesson?.summary || null,
    opening_scene: lesson?.opening_scene || null,
    big_idea: lesson?.big_idea || null,
    explanation_sections: lesson?.explanation_sections || [],
    takeaways: lesson?.takeaways || [],
    misconceptions: lesson?.misconceptions || [],
    discussion_questions: lesson?.discussion_questions || [],
    at_home_try: lesson?.at_home_try || [],
    evidence: lesson?.evidence || [],
  };
}

function buildImagePrompt(title: string, summary: string, lesson: LessonContentPack, assetType: "poster" | "cover" | "inline"): string {
  const customPrompt = assetType === "poster"
    ? lesson.visual_brief?.poster_prompt
    : assetType === "cover"
    ? lesson.visual_brief?.cover_prompt
    : lesson.visual_brief?.inline_prompt;
  const fallbackBody = [
    `标题：${title}`,
    `主题摘要：${summary}`,
    `核心意思：${lesson.big_idea || summary}`,
    `画面重点：${cleanList(assetType === "poster" ? lesson.poster_points : lesson.takeaways).slice(0, 3).join("；") || "突出本讲中心概念"}`,
    assetType === "poster"
      ? "输出要求：适合微信公众号贴图，中文信息密度较高，儿童友好，构图清晰。"
      : assetType === "cover"
      ? "输出要求：适合作为公众号文章封面，横向构图，主题明确。"
      : "输出要求：适合作为公众号正文插图，帮助解释核心概念。",
  ].join("\n");
  return [customPrompt || fallbackBody].join("\n");
}

function imageGenScriptPath(): string {
  return path.resolve(process.cwd(), "skills/sweety-image-gen/scripts/main.ts");
}

function hasImageGenConfig(): boolean {
  if (process.env.AI_CAT_ENABLE_IMAGE_GEN === "0") return false;
  const envKeys = [
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "RELAY_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "DASHSCOPE_API_KEY",
    "REPLICATE_API_TOKEN",
    "ARK_API_KEY",
  ];
  if (envKeys.some((key) => Boolean(process.env[key]?.trim()))) return true;
  const configPaths = [
    path.join(process.cwd(), ".sweety-skills", "sweety-image-gen", "EXTEND.md"),
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "sweety-skills", "sweety-image-gen", "EXTEND.md"),
    path.join(os.homedir(), ".sweety-skills", "sweety-image-gen", "EXTEND.md"),
  ];
  return configPaths.some((filePath) => fs.existsSync(filePath));
}

function generateImageWithFallback(promptPath: string, outputPath: string, aspectRatio: string, configOrder: string[]): boolean {
  if (!hasImageGenConfig()) return false;
  const providers = uniqueStrings(configOrder).filter((provider) => KNOWN_IMAGE_PROVIDERS.has(provider));
  const attempts = providers.length > 0 ? providers : [""];
  for (const provider of attempts) {
    const result = spawnSync("npx", [
      "-y",
      "bun",
      imageGenScriptPath(),
      "--promptfiles",
      promptPath,
      "--image",
      outputPath,
      "--ar",
      aspectRatio,
      "--quality",
      "2k",
      ...(provider ? ["--provider", provider] : []),
      "--json",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (result.status === 0 && fs.existsSync(outputPath)) return true;
  }
  return false;
}

async function createLessonAssets(
  sourceUrl: string,
  itemNo: number,
  rootDir: string,
  title: string,
  summary: string,
  lesson: LessonContentPack | null,
  slot: Slot,
  configOrder: string[],
): Promise<{ posterPath: string; coverPath: string; inlinePath: string }> {
  const slug = sanitizeSlug(title);
  const posterPath = path.join(rootDir, "assets", "poster", `poster-${slug}.png`);
  const coverPath = path.join(rootDir, "assets", "cover", `cover-${slug}.png`);
  const inlinePath = path.join(rootDir, "assets", "inline", `inline-${slug}.png`);

  const cachedPoster = lesson?.asset_files?.poster_image
    ? path.resolve(lesson.asset_files.poster_image)
    : resolveCachedLessonAsset(sourceUrl, itemNo, "poster.png");
  const cachedCover = lesson?.asset_files?.cover_image
    ? path.resolve(lesson.asset_files.cover_image)
    : resolveCachedLessonAsset(sourceUrl, itemNo, "cover.png");
  const cachedInline = lesson?.asset_files?.inline_images?.[0]
    ? path.resolve(lesson.asset_files.inline_images[0]!)
    : resolveCachedLessonAsset(sourceUrl, itemNo, "inline-01.png");

  const copiedPoster = copyAssetIfPresent(cachedPoster, posterPath);
  const copiedCover = copyAssetIfPresent(cachedCover, coverPath);
  const copiedInline = copyAssetIfPresent(cachedInline, inlinePath);

  if (!lesson) {
    if (!copiedPoster) await createTextImage(title, "课程配图", posterPath, slot, 1080, 1440);
    if (!copiedCover) await createTextImage(title, "课程封面", coverPath, slot, 900, 383);
    if (!copiedInline) await createTextImage(title, "课程讲解", inlinePath, slot, 1080, 1440);
    return { posterPath, coverPath, inlinePath };
  }

  if (copiedPoster && copiedCover && copiedInline) {
    return { posterPath, coverPath, inlinePath };
  }

  const promptDir = path.join(rootDir, "research", "prompts");
  fs.mkdirSync(promptDir, { recursive: true });
  const posterPromptPath = path.join(promptDir, "poster.md");
  const coverPromptPath = path.join(promptDir, "cover.md");
  const inlinePromptPath = path.join(promptDir, "inline.md");
  fs.writeFileSync(posterPromptPath, `${buildImagePrompt(title, summary, lesson, "poster")}\n`, "utf8");
  fs.writeFileSync(coverPromptPath, `${buildImagePrompt(title, summary, lesson, "cover")}\n`, "utf8");
  fs.writeFileSync(inlinePromptPath, `${buildImagePrompt(title, summary, lesson, "inline")}\n`, "utf8");

  const posterOk = generateImageWithFallback(posterPromptPath, posterPath, "3:4", configOrder);
  const coverOk = generateImageWithFallback(coverPromptPath, coverPath, "16:9", configOrder);
  const inlineOk = generateImageWithFallback(inlinePromptPath, inlinePath, "3:4", configOrder);

  if (!copiedPoster && !posterOk) await createStructuredPosterImage(title, lesson, posterPath, slot);
  if (!copiedCover && !coverOk) await createTextImage(title, "课程连载封面", coverPath, slot, 900, 383);
  if (!copiedInline && !inlineOk) await createStructuredInlineImage(title, lesson, inlinePath, slot);

  return { posterPath, coverPath, inlinePath };
}

function collectSourceUrls(course: CourseCatalog, lesson: LessonContentPack | null, pack: CourseSourcePack | null): { sourceUrls: string[]; sourceTypes: string[] } {
  const sourceUrls = uniqueStrings([
    course.catalog_source_url,
    ...(pack?.catalog_source_documents || []).map((entry) => entry.source_url),
    ...(lesson?.evidence || []).map((entry) => entry.source_url),
  ]);
  const sourceTypes = uniqueStrings([
    ...(lesson?.evidence || []).map((entry) => entry.source_type),
    ...(pack?.catalog_source_documents || []).map((entry) => entry.source_type),
  ]);
  return { sourceUrls, sourceTypes };
}

function localCourseCacheDir(sourceUrl: string): string | null {
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://") || sourceUrl.startsWith("file://")) return null;
  const sourcePath = path.resolve(sourceUrl);
  if (!sourcePath.endsWith(".source.json")) return null;
  return sourcePath.replace(/\.source\.json$/i, "");
}

function resolveCachedLessonAsset(sourceUrl: string, itemNo: number, assetName: string): string | null {
  const cacheDir = localCourseCacheDir(sourceUrl);
  if (!cacheDir) return null;
  const lessonDir = path.join(cacheDir, String(itemNo).padStart(2, "0"));
  const candidate = path.join(lessonDir, assetName);
  return fs.existsSync(candidate) ? candidate : null;
}

function copyAssetIfPresent(sourcePath: string | null | undefined, targetPath: string): boolean {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function prepareRunDirectories(outputRoot: string, runSlug: string): string {
  const root = path.resolve(process.cwd(), outputRoot, runSlug);
  for (const child of [
    root,
    path.join(root, "assets", "poster"),
    path.join(root, "assets", "cover"),
    path.join(root, "assets", "inline"),
    path.join(root, "publish"),
    path.join(root, "research"),
  ]) {
    fs.mkdirSync(child, { recursive: true });
  }
  return root;
}

function writeManifest(rootDir: string, manifest: RunManifest): string {
  const manifestPath = path.join(rootDir, "publish", "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

function callCatalogSync(track: Track, dataDir: string): void {
  spawnSync("npx", [
    "-y",
    "bun",
    path.resolve(process.cwd(), "skills/ai-cat-wechat/scripts/catalog-sync.ts"),
    "--track",
    track,
    "--data-dir",
    dataDir,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function publisherScriptPath(): string {
  return process.env.AI_CAT_PUBLISH_WITH_FALLBACK_SCRIPT?.trim()
    ? path.resolve(process.env.AI_CAT_PUBLISH_WITH_FALLBACK_SCRIPT.trim())
    : path.resolve(process.cwd(), "skills/ai-cat-wechat/scripts/publish-with-fallback.ts");
}

function runPublisher(filePath: string, workType: WorkType, account: string, manifestPath: string, dryRun: boolean): { ok: boolean; parsed: Record<string, unknown> | null; reason: string } {
  const result = spawnSync("npx", [
    "-y",
    "bun",
    publisherScriptPath(),
    "--file",
    filePath,
    "--work-type",
    workType,
    "--account",
    account,
    "--manifest",
    manifestPath,
    ...(dryRun ? ["--dry-run"] : []),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  return {
    ok: result.status === 0,
    parsed,
    reason: stderr || stdout || `publisher exited with ${result.status ?? 1}`,
  };
}

function resolveDraftMediaId(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null;
  if (typeof parsed.draft_media_id === "string" && parsed.draft_media_id) return parsed.draft_media_id;
  const outerResult = parsed.result;
  if (outerResult && typeof outerResult === "object") {
    const outer = outerResult as Record<string, unknown>;
    if (typeof outer.media_id === "string" && outer.media_id) return outer.media_id;
    const innerResult = outer.result;
    if (innerResult && typeof innerResult === "object") {
      const inner = innerResult as Record<string, unknown>;
      if (typeof inner.media_id === "string" && inner.media_id) return inner.media_id;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const slot = parseSlot(getArg("--slot"));
  const account = getArg("--account");
  const publish = hasFlag("--publish");
  const dryRun = hasFlag("--dry-run");
  const dataDir = ensureAiCatDataDir(getArg("--data-dir"));
  const config = loadAiCatConfig(dataDir);
  const requestedDate = getArg("--date") || nowDate(config.timezone);
  const hotCaseFile = getArg("--hot-case-file");
  const newsFile = getArg("--news-file");

  if (!slot || !account) {
    console.error("Usage: run.ts --slot <kids|adult|evening|news> --account <alias> [--publish] [--date YYYY-MM-DD] [--hot-case-file path] [--news-file path]");
    process.exit(1);
  }

  const trackKey = slotToTrack(slot);
  const state = loadTrackState(dataDir);
  let history = loadRunHistory(dataDir);
  let hotCaseHistory = loadHotCaseHistory(dataDir);
  let catalogs = loadCatalogs(dataDir);

  if (trackKey !== "news") {
    callCatalogSync(trackKey, dataDir);
    catalogs = loadCatalogs(dataDir);
  }

  let title = "";
  let summary = "";
  let workType: WorkType = "poster";
  let markdownPath = "";
  let manifestPath = "";
  let sourceKind: "course" | "hot-case" | "news" = "course";
  let course: CourseCatalog | null = null;
  let item: CatalogItem | null = null;

  const runIdBase = `${dateStamp(requestedDate)}-${slot}`;

  if (slot === "news") {
    const newsItems = await Promise.resolve(fileOrUrlItems<NewsItem>(newsFile));
    const selected = selectNewsItems(newsItems, config.news.max_items, config.news.min_items, config.news.lookback_hours).slice(0, config.news.digest_count);
    if (selected.length < config.news.min_items) {
      console.error("No enough news items available for automated digest");
      process.exit(2);
    }
    title = `AI 新闻晚报 ${requestedDate}`;
    summary = `精选 ${selected.length} 条 AI 新闻，每条都补上背景和影响判断，方便晚上统一补课。`;
    workType = "article";
    const runSlug = `${runIdBase}-${sanitizeSlug(title)}`;
    const rootDir = prepareRunDirectories(config.default_output_dir, runSlug);
    const coverPath = path.join(rootDir, "assets", "cover", `cover-${sanitizeSlug(title)}.png`);
    const inlinePath = path.join(rootDir, "assets", "inline", `inline-${sanitizeSlug(title)}.png`);
    await createTextImage(title, "AI 新闻补充", coverPath, slot, 900, 383);
    await createTextImage(title, "晚间新闻简报", inlinePath, slot, 1080, 1440);
    const relativeCover = path.relative(rootDir, coverPath).split(path.sep).join("/");
    const relativeInline = path.relative(rootDir, inlinePath).split(path.sep).join("/");
    const article = [
      "---",
      `title: ${title}`,
      `summary: ${summary}`,
      `coverImage: ${relativeCover}`,
      "---",
      "",
      `# ${title}`,
      "",
      summary,
      "",
      `![晚报封面](${relativeInline})`,
      "",
      ...selected.flatMap((entry, index) => [
        `## ${index + 1}. ${entry.title}`,
        "",
        `${entry.summary} 这条消息的影响点在于 ${entry.impact}。`,
        "",
        `来源：${entry.source_name} ${entry.source_url}`,
        "",
      ]),
    ].join("\n");
    markdownPath = path.join(rootDir, "article.md");
    fs.writeFileSync(markdownPath, article, "utf8");
    manifestPath = writeManifest(rootDir, {
      version: 1,
      run_id: runSlug,
      slot,
      track: "news",
      source_kind: "news",
      title,
      summary,
      work_type: workType,
      account_alias: account,
      course_id: null,
      course_title: null,
      item_no: null,
      created_at: new Date().toISOString(),
      publishing: {
        poster_to_article_on_publish_failure: true,
        fallback_triggered: false,
        account_alias: account,
      },
      sources: {
        source_urls: selected.map((entry) => entry.source_url),
        source_types: selected.map((entry) => entry.source_name),
      },
      assets: {
        poster_image: null,
        article_cover: relativeCover,
        article_inline: [relativeInline],
      },
    });
  } else if (slot === "evening") {
    const hotCases = await Promise.resolve(fileOrUrlItems<HotCaseItem>(hotCaseFile));
    const chosenHotCase = selectHotCase(hotCases, config.hot_case.min_score, hotCaseHistory);
    if (chosenHotCase) {
      sourceKind = "hot-case";
      title = `热门案例拆解 ${requestedDate} - ${chosenHotCase.title}`;
      summary = `${chosenHotCase.summary} 本次优先拆解真实案例里的方法、动作和复盘价值，而不是只转述新闻。`;
      workType = "article";
      const runSlug = `${runIdBase}-${sanitizeSlug(title)}`;
      const rootDir = prepareRunDirectories(config.default_output_dir, runSlug);
      const coverPath = path.join(rootDir, "assets", "cover", `cover-${sanitizeSlug(title)}.png`);
      const inlinePath = path.join(rootDir, "assets", "inline", `inline-${sanitizeSlug(title)}.png`);
      await createTextImage(title, "实战案例拆解", coverPath, slot, 900, 383);
      await createTextImage(title, chosenHotCase.source_name, inlinePath, slot, 1080, 1440);
      const relativeCover = path.relative(rootDir, coverPath).split(path.sep).join("/");
      const relativeInline = path.relative(rootDir, inlinePath).split(path.sep).join("/");
      markdownPath = path.join(rootDir, "article.md");
      fs.writeFileSync(markdownPath, [
        "---",
        `title: ${title}`,
        `summary: ${summary}`,
        `coverImage: ${relativeCover}`,
        "---",
        "",
        `# ${title}`,
        "",
        summary,
        "",
        `![案例主图](${relativeInline})`,
        "",
        "## 这次为什么值得拆",
        "",
        `${chosenHotCase.summary} 这类案例有价值，是因为它能直接回到方法、执行动作和结果验证，不会只停在消息层面。`,
        "",
        "## 拆解重点",
        "",
        "先看案例解决了什么真实问题，再看它用了什么链路和素材，最后补上哪些条件是可复制的，哪些只适用于特定团队。",
        "",
        `来源：${chosenHotCase.source_name} ${chosenHotCase.source_url}`,
        "",
      ].join("\n"), "utf8");
      manifestPath = writeManifest(rootDir, {
        version: 1,
        run_id: runSlug,
        slot,
        track: "portfolio",
        source_kind: "hot-case",
        title,
        summary,
        work_type: workType,
        account_alias: account,
        course_id: null,
        course_title: null,
        item_no: null,
        created_at: new Date().toISOString(),
        publishing: {
          poster_to_article_on_publish_failure: true,
          fallback_triggered: false,
          account_alias: account,
        },
        sources: {
          source_urls: [chosenHotCase.source_url, ...(chosenHotCase.evidence_urls || [])],
          source_types: [chosenHotCase.source_name, "实战案例"],
        },
        assets: {
          poster_image: null,
          article_cover: relativeCover,
          article_inline: [relativeInline],
        },
      });
      hotCaseHistory = [
        ...hotCaseHistory,
        { hot_case_id: chosenHotCase.id, drafted_at: new Date().toISOString(), run_id: runSlug, title: chosenHotCase.title },
      ].slice(-50);
      saveHotCaseHistory(dataDir, hotCaseHistory);
    }
  }

  if (!manifestPath && trackKey !== "news") {
    course = ensureCourseAssigned(trackKey, catalogs, state);
    if (!course) {
      console.error(`No validated course catalog available for track: ${trackKey}`);
      process.exit(2);
    }
    item = course.catalog_items[state.tracks[trackKey].current_item_index] || null;
    if (!item) {
      console.error(`No catalog item left for track: ${trackKey}`);
      process.exit(2);
    }
    const numberedTitle = `${course.course_title} ${String(item.item_no).padStart(2, "0")} - ${item.title}`;
    const pack = await loadCourseSourcePack(course.catalog_source_url);
    const lesson = resolveLessonPack(pack, item);
    title = numberedTitle;
    summary = lesson?.summary || `${item.core_question} 这篇内容会按课程顺序推进，保留和前后章节之间的连续关系。`;
    workType = decideWorkType(item);
    const runSlug = `${runIdBase}-${sanitizeSlug(numberedTitle)}`;
    const rootDir = prepareRunDirectories(config.default_output_dir, runSlug);
    const { posterPath, coverPath, inlinePath } = await createLessonAssets(
      course.catalog_source_url,
      item.item_no,
      rootDir,
      numberedTitle,
      summary,
      lesson,
      slot,
      config.image_provider_fallback_order,
    );
    const relativePoster = path.relative(rootDir, posterPath).split(path.sep).join("/");
    const relativeCover = path.relative(rootDir, coverPath).split(path.sep).join("/");
    const relativeInline = path.relative(rootDir, inlinePath).split(path.sep).join("/");
    markdownPath = path.join(rootDir, workType === "poster" ? "poster.md" : "article.md");
    const markdown = lesson
      ? (workType === "poster"
        ? buildLessonPosterMarkdown(numberedTitle, summary, lesson, relativePoster)
        : buildLessonArticleMarkdown(numberedTitle, summary, lesson, relativeCover, relativeInline))
      : (workType === "poster"
        ? buildPosterMarkdown(numberedTitle, summary, item, relativePoster)
        : buildArticleMarkdown(numberedTitle, summary, item, relativeCover, relativeInline));
    fs.writeFileSync(markdownPath, markdown, "utf8");
    fs.writeFileSync(
      path.join(rootDir, "research", "brief.json"),
      `${JSON.stringify(buildResearchBrief(course, item, lesson, pack), null, 2)}\n`,
      "utf8",
    );
    const sourceMeta = collectSourceUrls(course, lesson, pack);
    manifestPath = writeManifest(rootDir, {
      version: 1,
      run_id: runSlug,
      slot,
      track: trackKey,
      source_kind: "course",
      title,
      summary,
      work_type: workType,
      account_alias: account,
      course_id: course.course_id,
      course_title: course.course_title,
      item_no: item.item_no,
      created_at: new Date().toISOString(),
      publishing: {
        poster_to_article_on_publish_failure: true,
        fallback_triggered: false,
        account_alias: account,
      },
      sources: {
        catalog_source_url: course.catalog_source_url,
        source_urls: sourceMeta.sourceUrls,
        source_types: sourceMeta.sourceTypes.length > 0 ? sourceMeta.sourceTypes : item.required_source_types,
      },
      assets: {
        poster_image: relativePoster,
        article_cover: relativeCover,
        article_inline: [relativeInline],
      },
    });
    saveTrackState(dataDir, state);
  }

  const runId = path.basename(path.dirname(path.dirname(manifestPath)));
  const entry: RunHistoryEntry = {
    run_id: runId,
    slot,
    track: trackKey === "news" ? "news" : trackKey,
    source_kind: sourceKind,
    account_alias: account,
    run_date: requestedDate,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "prepared",
    title,
    work_type: workType,
    output_dir: path.dirname(path.dirname(manifestPath)),
    manifest_path: manifestPath,
    course_id: course?.course_id || null,
    course_title: course?.course_title || null,
    item_no: item?.item_no || null,
    fallback_to_article: false,
    error: null,
    retry_of_run_id: null,
  };

  if (publish) {
    const result = runPublisher(markdownPath, workType, account, manifestPath, dryRun);
    entry.finished_at = new Date().toISOString();
    entry.status = result.ok ? "published" : "failed";
    entry.error = result.ok ? null : result.reason;
    entry.fallback_to_article = Boolean(result.parsed?.fallback_to_article);
    entry.publish_result = {
      ok: result.ok,
      attempts: entry.fallback_to_article ? 2 : 1,
      article_type: entry.fallback_to_article || workType === "article" ? "news" : "newspic",
      media_id: resolveDraftMediaId(result.parsed),
      draft_media_id: resolveDraftMediaId(result.parsed),
      fallback_to_article: entry.fallback_to_article,
      errors: Array.isArray(result.parsed?.errors) ? result.parsed?.errors as string[] : (result.ok ? [] : [result.reason]),
    };

    if (result.ok && trackKey !== "news" && sourceKind === "course") {
      const cursor = state.tracks[trackKey];
      cursor.last_run_at = entry.finished_at;
      cursor.last_published_run_id = entry.run_id;
      cursor.current_item_index += 1;
      cursor.status = "ready";
      if (course && cursor.current_item_index >= course.catalog_items.length) {
        cursor.completed_course_ids.push(course.course_id);
        cursor.current_course_id = null;
        cursor.current_item_index = 0;
      }
      saveTrackState(dataDir, state);
    } else if (!result.ok && trackKey !== "news") {
      state.tracks[trackKey].status = "blocked";
      state.tracks[trackKey].last_run_at = entry.finished_at;
      saveTrackState(dataDir, state);
    }

    if (!result.ok) {
      history = [...history, entry].slice(-200);
      saveRunHistory(dataDir, history);
      console.log(JSON.stringify({ ok: false, run: entry }, null, 2));
      process.exit(2);
    }
  } else {
    entry.finished_at = new Date().toISOString();
  }

  history = [...history, entry].slice(-200);
  saveRunHistory(dataDir, history);

  console.log(JSON.stringify({
    ok: true,
    run: entry,
    markdown_path: markdownPath,
    manifest_path: manifestPath,
  }, null, 2));
}

void main();
