import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Jimp, JimpMime, HorizontalAlign, VerticalAlign, loadFont, measureTextHeight } from "../../sweety-post-to-wechat/scripts/node_modules/jimp";
import type { WorkType } from "./types.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function extractJson(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    return null;
  }
}

function readDraftMediaId(manifestPath: string): string | null {
  if (!manifestPath || !fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      publish?: {
        draft_media_id?: string | null;
      };
    };
    return manifest.publish?.draft_media_id || null;
  } catch {
    return null;
  }
}

function publishScriptPath(): string {
  return process.env.AI_CAT_PUBLISH_DRAFT_SCRIPT?.trim()
    ? path.resolve(process.env.AI_CAT_PUBLISH_DRAFT_SCRIPT.trim())
    : path.resolve(import.meta.dir, "../../tujie-wanwu-wechat/scripts/publish-draft.ts");
}

function markdownTitle(markdownPath: string): string {
  const content = fs.readFileSync(markdownPath, "utf8");
  const frontmatterTitle = content.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  if (frontmatterTitle) return frontmatterTitle.replace(/^['"]|['"]$/g, "");
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return path.basename(markdownPath, path.extname(markdownPath));
}

function firstLocalImage(markdownPath: string): string | null {
  const content = fs.readFileSync(markdownPath, "utf8");
  const match = content.match(/!\[[^\]]*]\(([^)]+)\)/);
  if (!match?.[1]) return null;
  const ref = match[1].trim().replace(/^<|>$/g, "");
  if (/^https?:\/\//.test(ref)) return null;
  return path.resolve(path.dirname(markdownPath), ref);
}

async function createArticleCoverFromPoster(title: string, posterPath: string, outputPath: string): Promise<void> {
  const background = await Jimp.read(posterPath);
  background.cover({ w: 900, h: 383 });
  background.opacity(0.9);
  background.brightness(-0.2);

  const font = await loadFont(pathToFileURL(path.resolve(process.cwd(), "skills/sweety-post-to-wechat/scripts/node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-white/open-sans-32-white.fnt")).href);
  const subtitleFont = await loadFont(pathToFileURL(path.resolve(process.cwd(), "skills/sweety-post-to-wechat/scripts/node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-16-white/open-sans-16-white.fnt")).href);
  const safeTitle = title.slice(0, 42);
  const titleHeight = measureTextHeight(font, safeTitle, 760);

  background.print({
    font,
    x: 70,
    y: Math.max(48, 120 - Math.floor(titleHeight / 2)),
    text: {
      text: safeTitle,
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.MIDDLE,
    },
    maxWidth: 760,
    maxHeight: 140,
  });

  background.print({
    font: subtitleFont,
    x: 70,
    y: 280,
    text: {
      text: "自动由贴图降级为文章封面",
      alignmentX: HorizontalAlign.LEFT,
      alignmentY: VerticalAlign.TOP,
    },
    maxWidth: 700,
    maxHeight: 40,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.writeFileSync(outputPath, buffer);
}

async function createArticleFallback(markdownPath: string, manifestPath: string): Promise<{ markdownPath: string; coverPath: string }> {
  const posterImage = firstLocalImage(markdownPath);
  if (!posterImage || !fs.existsSync(posterImage)) {
    throw new Error("poster->article fallback requires an existing local poster image");
  }

  const rootDir = path.dirname(markdownPath);
  const publishDir = path.join(rootDir, "publish");
  const assetsDir = path.join(rootDir, "assets", "cover");
  const coverPath = path.join(assetsDir, `cover-${path.basename(rootDir)}.png`);
  const articlePath = path.join(rootDir, "article.fallback.md");
  const relativePoster = path.relative(rootDir, posterImage).split(path.sep).join("/");
  const relativeCover = path.relative(rootDir, coverPath).split(path.sep).join("/");
  const title = markdownTitle(markdownPath);

  await createArticleCoverFromPoster(title, posterImage, coverPath);

  const article = [
    "---",
    `title: ${title}`,
    `summary: ${title} 这一讲内容较长，贴图发布失败后已自动转为文章版，保留原主图并补充文字说明。`,
    `coverImage: ${relativeCover}`,
    "---",
    "",
    `# ${title}`,
    "",
    `${title} 这一讲先保留了原始贴图，再把需要展开说明的部分补成文章，方便在公众号里完整阅读。`,
    "",
    `![本讲贴图](${relativePoster})`,
    "",
    "## 这一讲讲什么",
    "",
    "这篇文章延续同一节课程的核心问题，先交代场景，再解释关键概念，最后补上使用边界和实际提醒。",
    "",
    "## 该怎么读",
    "",
    "如果你是第一次接触这个主题，可以先看主图建立整体印象，再看正文补上定义、步骤和注意点。已经熟悉这个主题的读者，可以重点看边界和常见误区。",
    "",
    "## 自动降级说明",
    "",
    "这次发布先尝试了贴图版本。由于贴图链路未成功，系统自动切换到文章模式，并重新生成了封面图。",
    "",
  ].join("\n");

  fs.mkdirSync(publishDir, { recursive: true });
  fs.writeFileSync(articlePath, article, "utf8");

  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.work_type = "article";
    manifest.summary = `${title} 这一讲内容较长，贴图发布失败后已自动转为文章版，保留原主图并补充文字说明。`;
    manifest.assets = {
      ...(manifest.assets as Record<string, unknown> || {}),
      article_cover: relativeCover,
      article_inline: [relativePoster],
    };
    manifest.publishing = {
      ...(manifest.publishing as Record<string, unknown> || {}),
      fallback_triggered: true,
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  return { markdownPath: articlePath, coverPath };
}

function invokePublisher(filePath: string, workType: WorkType, account: string, manifestPath: string, coverPath?: string, dryRun?: boolean): { ok: boolean; parsed: Record<string, unknown> | null; reason: string } {
  const args = [
    "-y",
    "bun",
    publishScriptPath(),
    filePath,
    "--work-type",
    workType,
    "--account",
    account,
    "--manifest",
    manifestPath,
  ];
  if (coverPath) args.push("--cover", coverPath);
  if (dryRun) args.push("--dry-run");

  const result = spawnSync("npx", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const parsed = extractJson((result.stdout || "").trim());
  if (result.status === 0 && parsed) {
    return { ok: true, parsed, reason: "" };
  }
  return {
    ok: false,
    parsed,
    reason: (result.stderr || result.stdout || `exit code ${result.status ?? 1}`).trim(),
  };
}

async function main(): Promise<void> {
  const filePath = getArg("--file");
  const account = getArg("--account");
  const workType = getArg("--work-type") as WorkType | undefined;
  const manifestPath = getArg("--manifest") || "";
  const dryRun = hasFlag("--dry-run");

  if (!filePath || !account || !workType || (workType !== "poster" && workType !== "article")) {
    console.error("Usage: publish-with-fallback.ts --file <markdown> --work-type <poster|article> --account <alias> --manifest <path> [--dry-run]");
    process.exit(1);
  }

  const firstAttempt = invokePublisher(path.resolve(filePath), workType, account, manifestPath, undefined, dryRun);
  if (firstAttempt.ok || workType === "article") {
    const draftMediaId = readDraftMediaId(manifestPath);
    console.log(JSON.stringify({
      ok: firstAttempt.ok,
      fallback_to_article: false,
      draft_media_id: draftMediaId,
      result: firstAttempt.parsed,
      errors: firstAttempt.ok ? [] : [firstAttempt.reason],
    }, null, 2));
    if (!firstAttempt.ok) process.exit(2);
    return;
  }

  const fallback = await createArticleFallback(path.resolve(filePath), manifestPath);
  const secondAttempt = invokePublisher(fallback.markdownPath, "article", account, manifestPath, fallback.coverPath, dryRun);
  const draftMediaId = readDraftMediaId(manifestPath);
  console.log(JSON.stringify({
    ok: secondAttempt.ok,
    fallback_to_article: true,
    draft_media_id: draftMediaId,
    result: secondAttempt.parsed,
    errors: secondAttempt.ok ? [firstAttempt.reason] : [firstAttempt.reason, secondAttempt.reason],
  }, null, 2));
  if (!secondAttempt.ok) process.exit(2);
}

void main();
