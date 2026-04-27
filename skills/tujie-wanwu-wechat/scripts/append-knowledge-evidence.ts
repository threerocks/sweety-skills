import fs from "node:fs";
import path from "node:path";

type Certainty = "高确定性" | "中确定性" | "有限确定性";

interface EvidenceItem {
  source_type: string;
  source_label: string;
  source_url: string;
  source_title: string;
  captured_at: string | null;
  evidence_for: string[];
  certainty: Certainty;
  independent: boolean;
  excerpt: string;
  notes: string;
}

interface EvidenceTask {
  title: string;
  category: string;
  evidence_items?: EvidenceItem[];
}

interface EvidencePayload {
  tasks?: EvidenceTask[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun append-knowledge-evidence.ts --input knowledge-evidence.json --title <topic-title> \\
    --source-type <type> --source-label <label> --source-url <url> --source-title <title> \\
    --evidence-for "目标A||目标B" --certainty <高确定性|中确定性|有限确定性> --excerpt <text> [--notes <text>]

将单条核心知识证据写入指定任务。`);
  process.exit(1);
}

function readInput(filePath: string): EvidencePayload {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as EvidencePayload;
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split("||").map((item) => item.trim()).filter(Boolean))];
}

function main(): void {
  const input = getArg("--input");
  const title = getArg("--title");
  const sourceType = getArg("--source-type");
  const sourceLabel = getArg("--source-label");
  const sourceUrl = getArg("--source-url");
  const sourceTitle = getArg("--source-title");
  const certainty = (getArg("--certainty") || "中确定性") as Certainty;
  const excerpt = getArg("--excerpt");
  const notes = getArg("--notes") || "";
  const capturedAt = getArg("--captured-at") || new Date().toISOString();
  const evidenceFor = splitList(getArg("--evidence-for"));

  if (!input || !title || !sourceType || !sourceLabel || !sourceUrl || !sourceTitle || !excerpt) {
    printUsage();
  }

  if (!["高确定性", "中确定性", "有限确定性"].includes(certainty)) {
    console.error("Invalid --certainty");
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  const payload = readInput(inputPath);
  const tasks = payload.tasks || [];
  const task = tasks.find((item) => item.title === title);

  if (!task) {
    console.error(`Task not found: ${title}`);
    process.exit(1);
  }

  const evidenceItem: EvidenceItem = {
    source_type: sourceType,
    source_label: sourceLabel,
    source_url: sourceUrl,
    source_title: sourceTitle,
    captured_at: capturedAt,
    evidence_for: evidenceFor,
    certainty,
    independent: true,
    excerpt,
    notes,
  };

  const current = task.evidence_items || [];
  const dedupeKey = `${evidenceItem.source_type}::${evidenceItem.source_url}::${evidenceItem.source_title}`;
  const next = current.filter((item) => `${item.source_type}::${item.source_url}::${item.source_title}` !== dedupeKey);
  next.push(evidenceItem);
  task.evidence_items = next;

  fs.writeFileSync(inputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    title,
    evidence_count: task.evidence_items.length,
  }, null, 2));
}

main();
