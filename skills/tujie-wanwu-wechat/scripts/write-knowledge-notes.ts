import fs from "node:fs";
import path from "node:path";

type SourceType =
  | "百科全书类资料"
  | "论文/综述/学术期刊"
  | "可追溯作者与出处的杂志科普或专业栏目"
  | "教材/课程资料/教辅"
  | "经过认证的培训资料、教育资料、机构公开教学材料";

interface ResultItem {
  topic_title: string;
  source_type: SourceType;
  source_label?: string;
  source_title: string;
  source_url: string;
  captured_at?: string;
  excerpt?: string;
  summary?: string;
  key_points?: string[];
  certainty_conclusion?: string;
  notes?: string[];
  research_note_path?: string;
}

interface ResultPayload {
  results?: ResultItem[];
}

const ALLOWED_SOURCE_TYPES = new Set<SourceType>([
  "百科全书类资料",
  "论文/综述/学术期刊",
  "可追溯作者与出处的杂志科普或专业栏目",
  "教材/课程资料/教辅",
  "经过认证的培训资料、教育资料、机构公开教学材料",
]);

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun write-knowledge-notes.ts --input knowledge-search-results.json [--research-dir research/core-knowledge]

把核心知识层搜索结果写成标准 research markdown 笔记。`);
  process.exit(1);
}

function readInput(filePath: string): ResultItem[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ResultItem[] | ResultPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  throw new Error("Input JSON must be an array or an object with a results array");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "topic";
}

function sourceTag(sourceType: SourceType): string {
  const table: Record<SourceType, string> = {
    "百科全书类资料": "encyclopedia",
    "论文/综述/学术期刊": "paper",
    "可追溯作者与出处的杂志科普或专业栏目": "magazine",
    "教材/课程资料/教辅": "textbook",
    "经过认证的培训资料、教育资料、机构公开教学材料": "education",
  };
  return table[sourceType];
}

function buildNotePath(researchDir: string, item: ResultItem, index: number): string {
  if (item.research_note_path) return path.resolve(item.research_note_path);
  const topicDir = path.join(path.resolve(researchDir), slugify(item.topic_title));
  const fileName = `${String(index + 1).padStart(2, "0")}-${sourceTag(item.source_type)}.md`;
  return path.join(topicDir, fileName);
}

function renderNote(item: ResultItem): string {
  const lines: string[] = [];
  lines.push(`# ${item.source_label || item.source_title}`);
  lines.push("");
  lines.push(`- 标题：${item.source_title}`);
  lines.push(`- 时间：${item.captured_at || new Date().toISOString()}`);
  lines.push(`- 链接：${item.source_url}`);
  lines.push(`- 来源类型：${item.source_type}`);
  lines.push("");

  if (item.summary || item.excerpt) {
    lines.push("## 核心信息");
    lines.push("");
    lines.push(item.summary || item.excerpt || "");
    lines.push("");
  }

  if (item.certainty_conclusion) {
    lines.push("## 可直接写入成稿的确定性结论");
    lines.push("");
    lines.push(item.certainty_conclusion);
    lines.push("");
  }

  if (Array.isArray(item.key_points) && item.key_points.length > 0) {
    lines.push("## 要点");
    lines.push("");
    for (const point of item.key_points) {
      lines.push(`- ${point}`);
    }
    lines.push("");
  }

  if (Array.isArray(item.notes) && item.notes.length > 0) {
    lines.push("## 备注");
    lines.push("");
    for (const note of item.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function main(): void {
  const input = getArg("--input");
  const researchDir = getArg("--research-dir") || "research/core-knowledge";
  if (!input) printUsage();

  const items = readInput(path.resolve(input));
  const written: string[] = [];
  const skipped: string[] = [];

  items.forEach((item, index) => {
    if (!ALLOWED_SOURCE_TYPES.has(item.source_type)) {
      skipped.push(`${item.topic_title}: 非法来源类型 ${item.source_type}`);
      return;
    }
    if (!item.source_title || !item.source_url) {
      skipped.push(`${item.topic_title}: 缺少 source_title 或 source_url`);
      return;
    }

    const notePath = buildNotePath(researchDir, item, index);
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, renderNote(item), "utf8");
    written.push(notePath);
  });

  console.log(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    written_count: written.length,
    written,
    skipped,
  }, null, 2));
}

main();
