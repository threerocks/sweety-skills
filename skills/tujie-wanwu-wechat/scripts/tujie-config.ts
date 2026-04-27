import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface TujieConfig {
  version?: number;
  wechat_account_alias?: string;
  agent_reach_skill_name?: string;
  agent_reach_bin?: string;
  agent_reach_python?: string;
  default_topic_count?: number;
  scan_window_hours?: number;
  recent_hot_window_days?: number;
  dedupe_hours?: number;
  output_dir?: string;
  publish_mode?: string;
  image_pipeline?: string;
  google_proxy_enabled?: boolean;
  poster_publish_fallback_enabled?: boolean;
  poster_publish_fallback_mode?: string;
  poster_publish_fallback_image?: string;
  storage_keep_days?: number;
  storage_prune_prompts?: boolean;
  storage_prune_temporary?: boolean;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function toBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function extractYamlFrontMatter(content: string): string | null {
  const match = content.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\s*$/);
  return match ? match[1]! : null;
}

function parseScalarConfig(yaml: string): TujieConfig {
  const config: TujieConfig = {};
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex <= 0) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = stripQuotes(trimmed.slice(colonIndex + 1).trim());
    if (!rawValue || rawValue === "null") continue;

    switch (key) {
      case "version": config.version = Number(rawValue); break;
      case "wechat_account_alias": config.wechat_account_alias = rawValue; break;
      case "agent_reach_skill_name": config.agent_reach_skill_name = rawValue; break;
      case "agent_reach_bin": config.agent_reach_bin = rawValue; break;
      case "agent_reach_python": config.agent_reach_python = rawValue; break;
      case "default_topic_count": config.default_topic_count = Number(rawValue); break;
      case "scan_window_hours": config.scan_window_hours = Number(rawValue); break;
      case "recent_hot_window_days": config.recent_hot_window_days = Number(rawValue); break;
      case "dedupe_hours": config.dedupe_hours = Number(rawValue); break;
      case "output_dir": config.output_dir = rawValue; break;
      case "publish_mode": config.publish_mode = rawValue; break;
      case "image_pipeline": config.image_pipeline = rawValue; break;
      case "google_proxy_enabled": config.google_proxy_enabled = toBoolean(rawValue); break;
      case "poster_publish_fallback_enabled": config.poster_publish_fallback_enabled = toBoolean(rawValue); break;
      case "poster_publish_fallback_mode": config.poster_publish_fallback_mode = rawValue; break;
      case "poster_publish_fallback_image": config.poster_publish_fallback_image = rawValue; break;
      case "storage_keep_days": config.storage_keep_days = Number(rawValue); break;
      case "storage_prune_prompts": config.storage_prune_prompts = toBoolean(rawValue); break;
      case "storage_prune_temporary": config.storage_prune_temporary = toBoolean(rawValue); break;
    }
  }
  return config;
}

export function loadTujieConfig(): TujieConfig {
  const candidates = [
    path.join(process.cwd(), ".sweety-skills", "tujie-wanwu-wechat", "EXTEND.md"),
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "sweety-skills", "tujie-wanwu-wechat", "EXTEND.md"),
    path.join(os.homedir(), ".sweety-skills", "tujie-wanwu-wechat", "EXTEND.md"),
  ];

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const yaml = extractYamlFrontMatter(content) || content;
      return parseScalarConfig(yaml);
    } catch {
      continue;
    }
  }

  return {};
}
