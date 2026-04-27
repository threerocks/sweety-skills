import fs from "node:fs";
import path from "node:path";
import { inferWechatFormatting } from "./theme-selector.ts";

type WorkType = "article" | "poster";

interface AssetSlot {
  role: string;
  expected_path: string;
  description: string;
}

interface PublishManifest {
  version: number;
  created_at: string;
  topic: string;
  topic_slug: string;
  work_type: WorkType;
  status: string;
  selection: {
    category: string | null;
    priority_tier: number | null;
    knowledge_angle: string | null;
  };
  research: {
    anchor_type: string | null;
    anchor_value: string | null;
    files: string[];
    selected_sources: string[];
    knowledge: {
      plan_file: string | null;
      search_file: string | null;
      evidence_file: string | null;
      report_file: string | null;
      ready: boolean;
      ready_titles: string[];
    };
  };
  assets: {
    cover: AssetSlot[];
    inline: AssetSlot[];
    poster: AssetSlot[];
  };
  formatting: {
    selected_theme: string | null;
    theme_candidates: string[];
    theme_selection_mode: string | null;
    theme_signals: string[];
    theme_rationale: string[];
    color: string | null;
  };
  publish: {
    mode: "draft";
    wechat_account_alias: string | null;
    method: "api";
    max_attempts: number;
    attempts: number;
    last_error: string | null;
    draft_media_id: string | null;
    history_recorded: boolean;
  };
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatDateStamp(input?: string): string {
  if (input) return input.replace(/-/g, "");
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function main(): void {
  const slug = getArg("--slug");
  const topic = getArg("--topic") || getArg("--topic-title") || "";
  const modeArg = getArg("--mode") || getArg("--work-type") || "article";
  const mode = modeArg as WorkType;
  const outputDir = getArg("--output-dir") || "wechat-tujie-wanwu";
  const dateStamp = formatDateStamp(getArg("--date"));
  const accountAlias = getArg("--wechat-account-alias") || null;
  const category = getArg("--category") || null;
  const priorityTierRaw = getArg("--priority-tier");
  const priorityTier = priorityTierRaw ? Number(priorityTierRaw) : null;
  const knowledgeAngle = getArg("--knowledge-angle") || null;

  if (!slug) {
    console.error("Missing required argument: --slug");
    process.exit(1);
  }

  if (mode !== "article" && mode !== "poster") {
    console.error("Invalid --mode/--work-type. Use article or poster.");
    process.exit(1);
  }

  const root = path.join(process.cwd(), outputDir, dateStamp, slug);
  const researchDir = path.join(root, "research");
  const assetsDir = path.join(root, "assets");
  const coverDir = path.join(assetsDir, "cover");
  const inlineDir = path.join(assetsDir, "inline");
  const posterDir = path.join(assetsDir, "poster");
  const publishDir = path.join(root, "publish");

  for (const dir of [root, researchDir, assetsDir, coverDir, inlineDir, posterDir, publishDir]) {
    ensureDir(dir);
  }

  const coverSlots: AssetSlot[] = mode === "article"
    ? [{
        role: "cover",
        expected_path: toPosix(path.relative(root, path.join(coverDir, `cover-${slug}.png`))),
        description: "文章封面图",
      }]
    : [];

  const inlineSlots: AssetSlot[] = mode === "article"
    ? [{
        role: "inline",
        expected_path: toPosix(path.relative(root, path.join(inlineDir, `inline-${slug}.png`))),
        description: "文章插图",
      }]
    : [];

  const posterSlots: AssetSlot[] = mode === "poster"
    ? [{
        role: "poster",
        expected_path: toPosix(path.relative(root, path.join(posterDir, `poster-${slug}.png`))),
        description: "贴图主图",
      }]
    : [];

  const manifest: PublishManifest = {
    version: 1,
    created_at: new Date().toISOString(),
    topic,
    topic_slug: slug,
    work_type: mode,
    status: hasFlag("--completed") ? "completed" : "initialized",
    selection: {
      category,
      priority_tier: Number.isFinite(priorityTier) ? priorityTier : null,
      knowledge_angle: knowledgeAngle,
    },
    research: {
      anchor_type: null,
      anchor_value: null,
      files: [],
      selected_sources: [],
      knowledge: {
        plan_file: null,
        search_file: null,
        evidence_file: null,
        report_file: null,
        ready: false,
        ready_titles: [],
      },
    },
    assets: {
      cover: coverSlots,
      inline: inlineSlots,
      poster: posterSlots,
    },
    formatting: {
      selected_theme: null,
      theme_candidates: [],
      theme_selection_mode: null,
      theme_signals: [],
      theme_rationale: [],
      color: null,
    },
    publish: {
      mode: "draft",
      wechat_account_alias: accountAlias,
      method: "api",
      max_attempts: 2,
      attempts: 0,
      last_error: null,
      draft_media_id: null,
      history_recorded: false,
    },
  };

  const formatting = inferWechatFormatting({
    filePath: path.join(root, mode === "poster" ? "poster.md" : "article.md"),
    workType: mode,
    manifestData: manifest,
    contentText: [topic, knowledgeAngle || ""].filter(Boolean).join("\n"),
  });

  manifest.formatting = {
    selected_theme: formatting.theme,
    theme_candidates: [formatting.theme, ...formatting.alternatives],
    theme_selection_mode: formatting.selectionMode,
    theme_signals: formatting.signals,
    theme_rationale: formatting.rationale,
    color: formatting.color,
  };

  const manifestPath = path.join(publishDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    root,
    manifest: manifestPath,
    work_type: mode,
  }, null, 2));
}

main();
