import fs from "node:fs";
import path from "node:path";

interface SeedItem {
  job_id: string;
  topic_title: string;
  category: string;
  source_type: string;
  priority_order: number | null;
  source_label: string;
  source_title: string;
  source_url: string;
  recommended_domains?: string[];
  recommended_search_queries?: string[];
  query_variants?: string[];
  goal?: string;
  evidence_targets?: string[];
  research_note_path?: string | null;
  fill_rules?: string[];
  notes?: string[];
}

interface SeedPayload {
  seeds?: SeedItem[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun render-knowledge-url-seeds.ts --input knowledge-url-seeds.json [--output knowledge-url-seeds.md]

把 URL 种子模板渲染成人工可编辑的 Markdown 清单。`);
  process.exit(1);
}

function readSeeds(filePath: string): SeedItem[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SeedItem[] | SeedPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.seeds)) return parsed.seeds;
  throw new Error("Seed JSON must be an array or an object with a seeds array");
}

function blockLines(seed: SeedItem): string[] {
  return [
    "<!-- seed:start",
    `job_id: ${seed.job_id}`,
    `topic_title: ${seed.topic_title}`,
    `category: ${seed.category}`,
    `source_type: ${seed.source_type}`,
    `priority_order: ${seed.priority_order ?? ""}`,
    `source_label: ${seed.source_label || ""}`,
    `source_title: ${seed.source_title || ""}`,
    `source_url: ${seed.source_url || ""}`,
    `research_note_path: ${seed.research_note_path || ""}`,
    "extra_notes: ",
    "seed:end -->",
  ];
}

function renderSeed(seed: SeedItem, index: number): string {
  const lines: string[] = [];
  lines.push(`## ${index + 1}. ${seed.topic_title}`);
  lines.push("");
  lines.push(`- 来源类型：${seed.source_type}`);
  lines.push(`- 优先级顺位：${seed.priority_order ?? ""}`);
  lines.push(`- 目标：${seed.goal || ""}`);
  lines.push(`- 证据目标：${(seed.evidence_targets || []).join("；")}`);
  lines.push(`- 研究笔记路径：${seed.research_note_path || ""}`);
  lines.push("");
  lines.push("### 可编辑种子块");
  lines.push("");
  lines.push(...blockLines(seed));
  lines.push("");

  if ((seed.recommended_domains || []).length > 0) {
    lines.push("### 推荐站点");
    lines.push("");
    for (const item of seed.recommended_domains || []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if ((seed.recommended_search_queries || []).length > 0) {
    lines.push("### 推荐搜索语句");
    lines.push("");
    for (const item of seed.recommended_search_queries || []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if ((seed.fill_rules || []).length > 0) {
    lines.push("### 填写规则");
    lines.push("");
    for (const item of seed.fill_rules || []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if ((seed.notes || []).length > 0) {
    lines.push("### 备注");
    lines.push("");
    for (const item of seed.notes || []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const seeds = readSeeds(path.resolve(input));
  const sections: string[] = [];
  sections.push("# 核心知识 URL 种子补充清单");
  sections.push("");
  sections.push("填写说明：只修改每个条目里的 `可编辑种子块`，其余说明文字不需要改。");
  sections.push("至少补 `source_title` 和 `source_url`。如有需要，可在 `extra_notes` 里补 DOI、教材版本或机构名。");
  sections.push("");

  seeds.forEach((seed, index) => {
    sections.push(renderSeed(seed, index));
  });

  const markdown = `${sections.join("\n").trim()}\n`;

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");
  }

  console.log(markdown);
}

main();
