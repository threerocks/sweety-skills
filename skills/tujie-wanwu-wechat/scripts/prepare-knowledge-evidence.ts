import fs from "node:fs";
import path from "node:path";

interface SearchPacket {
  source_type: string;
  priority_order: number;
  query_variants: string[];
  goal: string;
}

interface SearchTask {
  title: string;
  category: string;
  score?: number;
  knowledge_angle?: string | null;
  min_knowledge_sources?: number;
  evidence_targets?: string[];
  certainty_policy?: string[];
  search_packets?: SearchPacket[];
  notes?: string[];
}

interface SearchPayload {
  tasks?: SearchTask[];
}

interface EvidenceItem {
  source_type: string;
  source_label: string;
  source_url: string;
  source_title: string;
  captured_at: string | null;
  evidence_for: string[];
  certainty: "高确定性" | "中确定性" | "有限确定性";
  independent: boolean;
  excerpt: string;
  notes: string;
}

interface EvidenceTask {
  title: string;
  category: string;
  score: number;
  knowledge_angle: string | null;
  min_knowledge_sources: number;
  evidence_targets: string[];
  certainty_policy: string[];
  allowed_source_types: string[];
  search_packets: SearchPacket[];
  evidence_items: EvidenceItem[];
  notes: string[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun prepare-knowledge-evidence.ts --input knowledge-search.json [--output knowledge-evidence.json]

根据核心知识检索输入生成统一证据模板。`);
  process.exit(1);
}

function readInput(filePath: string): SearchTask[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SearchTask[] | SearchPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
  throw new Error("Input JSON must be an array or an object with a tasks array");
}

function buildEvidenceTask(task: SearchTask): EvidenceTask {
  return {
    title: task.title,
    category: task.category,
    score: task.score ?? 0,
    knowledge_angle: task.knowledge_angle || null,
    min_knowledge_sources: Math.max(0, Math.round(task.min_knowledge_sources ?? 1)),
    evidence_targets: task.evidence_targets || [],
    certainty_policy: task.certainty_policy || [],
    allowed_source_types: (task.search_packets || []).map((packet) => packet.source_type),
    search_packets: task.search_packets || [],
    evidence_items: [],
    notes: task.notes || [],
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const tasks = readInput(path.resolve(input)).map(buildEvidenceTask);
  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    task_count: tasks.length,
    tasks,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
