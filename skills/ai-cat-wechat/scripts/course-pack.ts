import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import type { CatalogItem, CourseSourcePack, EvidenceSource, LessonContentPack } from "./types.ts";

function dedupeStrings(values: string[] | undefined, fallback: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values || fallback) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result.length > 0 ? result : fallback;
}

function normalizeCatalogItem(raw: Partial<CatalogItem>, index: number): CatalogItem {
  const title = String(raw.title || "").trim() || `第 ${index + 1} 讲`;
  return {
    item_no: Number(raw.item_no || index + 1),
    title,
    core_question: String(raw.core_question || `${title} 这一讲要解释什么、怎么用、哪些地方容易误解。`).trim(),
    seed_keywords: dedupeStrings(raw.seed_keywords, [title]),
    required_source_types: dedupeStrings(raw.required_source_types, ["官方文档", "课程资料"]),
    default_work_type: raw.default_work_type === "article" ? "article" : "poster",
    teaching_points: dedupeStrings(raw.teaching_points, []),
    source_notes: dedupeStrings(raw.source_notes, []),
  };
}

function normalizeEvidence(raw: Partial<EvidenceSource>): EvidenceSource {
  return {
    source_label: String(raw.source_label || raw.source_title || "资料来源").trim(),
    source_type: String(raw.source_type || "参考资料").trim(),
    source_title: String(raw.source_title || raw.source_label || "未命名资料").trim(),
    source_url: String(raw.source_url || "").trim(),
    captured_at: raw.captured_at ? String(raw.captured_at) : undefined,
    excerpt: raw.excerpt ? String(raw.excerpt).trim() : undefined,
    notes: dedupeStrings(raw.notes, []),
  };
}

function normalizeLesson(raw: Partial<LessonContentPack>, index: number): LessonContentPack {
  return {
    item_no: Number(raw.item_no || index + 1),
    title: String(raw.title || `第 ${index + 1} 讲`).trim(),
    summary: String(raw.summary || "").trim(),
    opening_scene: String(raw.opening_scene || "").trim(),
    big_idea: String(raw.big_idea || "").trim(),
    explanation_sections: Array.isArray(raw.explanation_sections)
      ? raw.explanation_sections
        .map((section) => ({
          heading: String(section?.heading || "").trim(),
          body: String(section?.body || "").trim(),
        }))
        .filter((section) => section.heading && section.body)
      : [],
    takeaways: dedupeStrings(raw.takeaways, []),
    misconceptions: dedupeStrings(raw.misconceptions, []),
    discussion_questions: dedupeStrings(raw.discussion_questions, []),
    at_home_try: dedupeStrings(raw.at_home_try, []),
    poster_points: dedupeStrings(raw.poster_points, []),
    visual_brief: raw.visual_brief ? {
      poster_prompt: raw.visual_brief.poster_prompt ? String(raw.visual_brief.poster_prompt).trim() : undefined,
      cover_prompt: raw.visual_brief.cover_prompt ? String(raw.visual_brief.cover_prompt).trim() : undefined,
      inline_prompt: raw.visual_brief.inline_prompt ? String(raw.visual_brief.inline_prompt).trim() : undefined,
    } : undefined,
    asset_files: raw.asset_files ? {
      poster_image: raw.asset_files.poster_image ? String(raw.asset_files.poster_image).trim() : undefined,
      cover_image: raw.asset_files.cover_image ? String(raw.asset_files.cover_image).trim() : undefined,
      inline_images: dedupeStrings(raw.asset_files.inline_images, []),
    } : undefined,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map((entry) => normalizeEvidence(entry)) : [],
  };
}

export async function readCourseSourceText(sourceUrl: string): Promise<string> {
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`failed to fetch ${sourceUrl}: ${response.status}`);
    return await response.text();
  }

  if (sourceUrl.startsWith("file://")) {
    const fileUrl = new URL(sourceUrl);
    return fs.readFileSync(fileUrl, "utf8");
  }

  return fs.readFileSync(path.resolve(sourceUrl), "utf8");
}

export function parseCourseSourcePack(content: string): CourseSourcePack | null {
  try {
    const parsed = JSON.parse(content) as Partial<CourseSourcePack>;
    if (!Array.isArray(parsed.catalog_items)) return null;
    return {
      course_id: String(parsed.course_id || "").trim(),
      course_title: String(parsed.course_title || "").trim(),
      provider: String(parsed.provider || "").trim(),
      catalog_overview: parsed.catalog_overview ? String(parsed.catalog_overview).trim() : undefined,
      catalog_source_documents: Array.isArray(parsed.catalog_source_documents)
        ? parsed.catalog_source_documents.map((entry) => normalizeEvidence(entry))
        : [],
      catalog_items: parsed.catalog_items.map((item, index) => normalizeCatalogItem(item, index)),
      lessons: Array.isArray(parsed.lessons)
        ? parsed.lessons.map((lesson, index) => normalizeLesson(lesson, index))
        : [],
    };
  } catch {
    return null;
  }
}

export async function loadCourseSourcePack(sourceUrl: string): Promise<CourseSourcePack | null> {
  try {
    const content = await readCourseSourceText(sourceUrl);
    const parsed = parseCourseSourcePack(content);
    if (!parsed) return null;
    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://") && !sourceUrl.startsWith("file://")) {
      const sourcePath = path.resolve(sourceUrl);
      const companionPath = sourcePath.replace(/\.source\.json$/i, ".lessons.json");
      if (companionPath !== sourcePath && fs.existsSync(companionPath)) {
        try {
          const companion = JSON.parse(fs.readFileSync(companionPath, "utf8")) as { lessons?: Partial<LessonContentPack>[] };
          if (Array.isArray(companion.lessons)) {
            parsed.lessons = companion.lessons.map((lesson, index) => normalizeLesson(lesson, index));
          }
        } catch {
          // ignore broken companion file and fall back to lessons in source pack
        }
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveLessonPack(pack: CourseSourcePack | null, item: CatalogItem): LessonContentPack | null {
  if (!pack?.lessons || pack.lessons.length === 0) return null;
  return pack.lessons.find((lesson) => lesson.item_no === item.item_no || lesson.title === item.title) || null;
}
