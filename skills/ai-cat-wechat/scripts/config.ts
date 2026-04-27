import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCatConfig, Slot } from "./types.ts";

const DEFAULT_CONFIG: AiCatConfig = {
  timezone: "Asia/Shanghai",
  default_output_dir: "ai-cat-wechat-runs",
  wechat_publish_mode: "draft",
  image_strategy: "poster-first",
  slot_times: {
    kids: "08:00",
    adult: "12:00",
    evening: "18:00",
    news: "21:00",
  },
  catalog_min_items: 3,
  hot_case: {
    lookback_hours: 24,
    min_score: 70,
    max_items: 5,
  },
  news: {
    lookback_hours: 24,
    digest_count: 4,
    min_items: 3,
    max_items: 5,
  },
  poster_to_article_on_publish_failure: true,
  image_provider_fallback_order: ["google", "relay", "dashscope"],
};

function candidatePaths(dataDir?: string): string[] {
  if (dataDir) return [path.join(dataDir, "EXTEND.md")];
  return [
    path.join(process.cwd(), ".sweety-skills", "ai-cat-wechat", "EXTEND.md"),
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "sweety-skills", "ai-cat-wechat", "EXTEND.md"),
    path.join(os.homedir(), ".sweety-skills", "ai-cat-wechat", "EXTEND.md"),
  ];
}

function parseArray(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function assignByPath(target: Record<string, unknown>, dottedKey: string, rawValue: string): void {
  const segments = dottedKey.split(".");
  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]!;
    const existing = cursor[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  const leaf = segments[segments.length - 1]!;
  const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
  if (value === "true" || value === "false" || value === "1" || value === "0") {
    cursor[leaf] = parseBoolean(value);
    return;
  }
  if (/^\d+$/.test(value)) {
    cursor[leaf] = Number(value);
    return;
  }
  if (value.includes(",") || value.startsWith("[")) {
    const parsed = parseArray(value);
    if (parsed.length > 1 || value.startsWith("[")) {
      cursor[leaf] = parsed;
      return;
    }
  }
  cursor[leaf] = value;
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (Array.isArray(base)) return (override as T) || base;
  if (!base || typeof base !== "object") return (override as T) || base;

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = result[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      result[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function resolveAiCatDataDir(explicit?: string): string {
  return explicit || process.env.AI_CAT_DATA_DIR || path.join(process.cwd(), ".sweety-skills", "ai-cat-wechat");
}

export function loadAiCatConfig(dataDir?: string): AiCatConfig {
  for (const filePath of candidatePaths(dataDir)) {
    try {
      const parsed: Record<string, unknown> = {};
      const content = fs.readFileSync(filePath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf(":");
        if (separator <= 0) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (!value) continue;
        assignByPath(parsed, key, value);
      }
      const merged = deepMerge(DEFAULT_CONFIG, parsed as Partial<AiCatConfig>);
      return merged;
    } catch {
      continue;
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function slotToTrack(slot: Slot): "news" | "kids" | "adult" | "portfolio" {
  if (slot === "news") return "news";
  if (slot === "evening") return "portfolio";
  return slot;
}
