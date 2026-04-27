import fs from "node:fs";
import path from "node:path";

type SourceType =
  | "百科全书类资料"
  | "论文/综述/学术期刊"
  | "可追溯作者与出处的杂志科普或专业栏目"
  | "教材/课程资料/教辅"
  | "经过认证的培训资料、教育资料、机构公开教学材料";

interface FindingItem {
  title: string;
  source_type: SourceType;
  source_label: string;
  source_url: string;
  source_title: string;
  excerpt: string;
  notes?: string;
  captured_at?: string;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) {
      values.push(process.argv[i + 1]!);
    }
  }
  return values;
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun extract-knowledge-findings.ts --title <topic-title> --input source-a.md [--input source-b.md] [--output knowledge-findings.json]
  npx -y bun extract-knowledge-findings.ts --title <topic-title> --dir research/ [--output knowledge-findings.json]

把核心知识层原始资料笔记抽取为 knowledge-findings.json。`);
  process.exit(1);
}

function collectMarkdownFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readFiles(): string[] {
  const inputs = getArgs("--input").map((item) => path.resolve(item));
  const dir = getArg("--dir");
  if (inputs.length > 0) return inputs;
  if (dir) {
    return collectMarkdownFiles(path.resolve(dir));
  }
  return [];
}

function firstMatch(content: string, pattern: RegExp): string | null {
  const match = content.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m");
  const match = content.match(pattern);
  return match?.[1]?.trim() || null;
}

function cleanupText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function excerptFromSection(content: string): string {
  const preferredSections = [
    "可直接写入成稿的确定性结论",
    "核心信息",
    "摘要",
    "要点",
  ];

  for (const name of preferredSections) {
    const section = extractSection(content, name);
    if (!section) continue;
    const cleaned = cleanupText(section);
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
    const excerpt = paragraphs.slice(0, 2).join("\n\n");
    if (excerpt) return excerpt;
  }

  const lines = cleanupText(content)
    .split("\n")
    .filter((line) => !/^#/.test(line) && !/^-\s*(标题|时间|链接|作者|来源)/.test(line));
  return lines.slice(0, 4).join("\n");
}

function inferSourceType(seed: string, fallback?: string): SourceType | null {
  const text = `${seed} ${fallback || ""}`;
  if (/百科|百科全书|词条|辞典/.test(text)) return "百科全书类资料";
  if (/论文|综述|期刊|journal|review|doi/i.test(text)) return "论文/综述/学术期刊";
  if (/教材|教辅|课程资料|讲义|课本/.test(text)) return "教材/课程资料/教辅";
  if (/培训|教育资料|公开课|机构公开教学|认证/.test(text)) return "经过认证的培训资料、教育资料、机构公开教学材料";
  if (/杂志|专栏|栏目|科普|作者|编辑/.test(text)) return "可追溯作者与出处的杂志科普或专业栏目";
  return null;
}

function parseSourceFile(filePath: string, topicTitle: string, defaultSourceType?: SourceType): FindingItem | null {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceLabel = firstMatch(content, /^#\s+(.+)$/m) || path.basename(filePath, ".md");
  const sourceTitle = firstMatch(content, /^-\s*标题：\s*(.+)$/m) || sourceLabel;
  const sourceUrl = firstMatch(content, /^-\s*链接：\s*(.+)$/m) || "";
  const capturedAt = firstMatch(content, /^-\s*时间：\s*(.+)$/m) || new Date().toISOString();
  const declaredSourceType = firstMatch(content, /^-\s*来源类型：\s*(.+)$/m) as SourceType | null;
  const excerpt = excerptFromSection(content);
  const sourceType = defaultSourceType || declaredSourceType || inferSourceType(sourceLabel, `${sourceTitle}\n${excerpt}`);

  if (!sourceType || !excerpt) return null;

  return {
    title: topicTitle,
    source_type: sourceType,
    source_label: sourceLabel,
    source_url: sourceUrl,
    source_title: sourceTitle,
    excerpt,
    captured_at: capturedAt,
    notes: `抽取自 ${filePath}`,
  };
}

function main(): void {
  const title = getArg("--title");
  const output = getArg("--output");
  const files = readFiles();
  const defaultSourceType = getArg("--default-source-type") as SourceType | undefined;

  if (!title || files.length === 0) printUsage();

  const findings: FindingItem[] = [];
  const skipped: string[] = [];

  for (const filePath of files) {
    const finding = parseSourceFile(filePath, title, defaultSourceType);
    if (!finding) {
      skipped.push(filePath);
      continue;
    }
    findings.push(finding);
  }

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    finding_count: findings.length,
    findings,
    skipped,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
