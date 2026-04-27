import fs from "node:fs";
import path from "node:path";
import { ensureAiCatDataDir, loadCatalogs, loadTrackState, loadWatchlists, saveCatalogs, saveTrackState } from "./store.ts";
import { loadAiCatConfig } from "./config.ts";
import { loadCourseSourcePack, readCourseSourceText } from "./course-pack.ts";
import type { CatalogItem, CourseCatalog, Track, WatchlistSource } from "./types.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseTrack(value: string | undefined): Track | undefined {
  if (value === "kids" || value === "adult" || value === "portfolio") return value;
  return undefined;
}

function stripHtml(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function normalizeLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+•]|\d+[.)、]|第?\d+\s*(?:讲|课|章|节|部分|part|chapter|module|lesson))\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCatalogLike(line: string): boolean {
  if (line.length < 4 || line.length > 80) return false;
  if (/^(首页|目录|课程介绍|学习目标|立即报名|免费试学)$/i.test(line)) return false;
  if (/[。！？]/.test(line)) return false;
  return /^[\dA-Za-z一二三四五六七八九十第].+/.test(line) || /(?:记忆|代理|工作流|提示词|案例|作品集|AI|模型|工具|评审|发布|入门|原理|章节|课|讲|lesson|module|chapter)/i.test(line);
}

function dedupeItems(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function defaultCatalogItem(title: string, index: number, source: WatchlistSource): CatalogItem {
  const keywords = dedupeItems(title.split(/[\s/，、]+/)).slice(0, 4);
  return {
    item_no: index + 1,
    title,
    core_question: `${title} 这一讲要解决什么问题，适合在什么场景使用，以及应该注意哪些边界。`,
    seed_keywords: keywords.length > 0 ? keywords : [source.course_title, title],
    required_source_types: source.knowledge_strategy?.length
      ? source.knowledge_strategy
      : ["官方文档", "课程资料", "案例复盘"],
    default_work_type: "poster",
  };
}

function extractCatalogItems(content: string, source: WatchlistSource): CatalogItem[] {
  if (source.seed_catalog_items && source.seed_catalog_items.length > 0) {
    return source.seed_catalog_items.map((item, index) => ({
      ...item,
      item_no: index + 1,
    }));
  }

  const text = stripHtml(content);
  const lines = dedupeItems(text.split("\n").map((line) => line.trim()).filter(Boolean));
  const candidates = lines.filter(isCatalogLike).slice(0, 24);
  return candidates.map((line, index) => defaultCatalogItem(line, index, source));
}

function buildCatalog(source: WatchlistSource, items: CatalogItem[], minItems: number): CourseCatalog {
  if (items.length < minItems) {
    return {
      course_id: source.course_id,
      track: source.track,
      course_title: source.course_title,
      provider: source.provider,
      catalog_source_url: source.catalog_source_url,
      source_type: source.source_type,
      priority: source.priority,
      evergreen: source.evergreen,
      catalog_items: items,
      knowledge_strategy: source.knowledge_strategy || [],
      validated_at: new Date().toISOString(),
      status: "failed",
      validation_error: `catalog items below minimum threshold: ${items.length}`,
    };
  }

  return {
    course_id: source.course_id,
    track: source.track,
    course_title: source.course_title,
    provider: source.provider,
    catalog_source_url: source.catalog_source_url,
    source_type: source.source_type,
    priority: source.priority,
    evergreen: source.evergreen,
    catalog_items: items.map((item, index) => ({ ...item, item_no: index + 1 })),
    knowledge_strategy: source.knowledge_strategy || [],
    validated_at: new Date().toISOString(),
    status: "validated",
  };
}

function upsertCatalog(existing: CourseCatalog[], next: CourseCatalog): CourseCatalog[] {
  const filtered = existing.filter((item) => item.course_id !== next.course_id);
  filtered.push(next);
  return filtered.sort((a, b) => a.track.localeCompare(b.track) || a.priority - b.priority || a.course_title.localeCompare(b.course_title));
}

function chooseInitialCourse(catalogs: CourseCatalog[], track: Track): string | null {
  return catalogs
    .filter((item) => item.track === track && item.status === "validated")
    .sort((a, b) => a.priority - b.priority || Number(Boolean(a.evergreen)) - Number(Boolean(b.evergreen)))
    .map((item) => item.course_id)[0] || null;
}

async function main(): Promise<void> {
  const dataDir = ensureAiCatDataDir(getArg("--data-dir"));
  const config = loadAiCatConfig(dataDir);
  const targetTrack = parseTrack(getArg("--track"));

  if (!targetTrack) {
    console.error("Usage: catalog-sync.ts --track <kids|adult|portfolio> [--data-dir path]");
    process.exit(1);
  }

  const watchlists = loadWatchlists(dataDir);
  const sources = watchlists.tracks[targetTrack] || [];
  if (sources.length === 0) {
    console.error(`No watchlist sources configured for track: ${targetTrack}`);
    process.exit(1);
  }

  let catalogs = loadCatalogs(dataDir);
  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    try {
      const pack = source.seed_catalog_items && source.seed_catalog_items.length > 0
        ? null
        : await loadCourseSourcePack(source.catalog_source_url);
      const raw = source.seed_catalog_items && source.seed_catalog_items.length > 0
        ? ""
        : (!pack ? await readCourseSourceText(source.catalog_source_url) : "");
      const items = pack?.catalog_items?.length
        ? pack.catalog_items.map((item, index) => ({ ...item, item_no: index + 1 }))
        : extractCatalogItems(raw, source);
      const catalog = buildCatalog(source, items, config.catalog_min_items);
      catalogs = upsertCatalog(catalogs, catalog);
      results.push({
        course_id: source.course_id,
        track: source.track,
        status: catalog.status,
        item_count: catalog.catalog_items.length,
        validation_error: catalog.validation_error || null,
      });
    } catch (error) {
      const failedCatalog = buildCatalog(source, [], config.catalog_min_items);
      failedCatalog.status = "failed";
      failedCatalog.validation_error = error instanceof Error ? error.message : String(error);
      catalogs = upsertCatalog(catalogs, failedCatalog);
      results.push({
        course_id: source.course_id,
        track: source.track,
        status: "failed",
        item_count: 0,
        validation_error: failedCatalog.validation_error,
      });
    }
  }

  saveCatalogs(dataDir, catalogs);

  const state = loadTrackState(dataDir);
  const current = state.tracks[targetTrack];
  if (!current.current_course_id) {
    current.current_course_id = chooseInitialCourse(catalogs, targetTrack);
    current.status = current.current_course_id ? "ready" : "blocked";
  }
  saveTrackState(dataDir, state);

  console.log(JSON.stringify({
    ok: true,
    data_dir: dataDir,
    track: targetTrack,
    current_course_id: state.tracks[targetTrack].current_course_id,
    results,
  }, null, 2));
}

void main();
