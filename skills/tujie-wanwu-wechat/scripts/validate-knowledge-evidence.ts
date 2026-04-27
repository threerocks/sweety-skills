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
  score?: number;
  knowledge_angle?: string | null;
  min_knowledge_sources?: number;
  evidence_targets?: string[];
  certainty_policy?: string[];
  allowed_source_types?: string[];
  search_packets?: Array<{ source_type: string; priority_order: number; query_variants: string[]; goal: string }>;
  evidence_items?: EvidenceItem[];
  notes?: string[];
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
  npx -y bun validate-knowledge-evidence.ts --input knowledge-evidence.json [--output knowledge-evidence-report.json]

校验核心知识证据是否达到可成稿门槛。`);
  process.exit(1);
}

function readInput(filePath: string): EvidenceTask[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as EvidenceTask[] | EvidencePayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
  throw new Error("Input JSON must be an array or an object with a tasks array");
}

function uniqueEvidenceCount(items: EvidenceItem[]): number {
  const keys = new Set<string>();
  for (const item of items) {
    const key = item.source_url || `${item.source_type}::${item.source_label}`;
    if (item.independent !== false) keys.add(key);
  }
  return keys.size;
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const tasks = readInput(path.resolve(input));
  const report = tasks.map((task) => {
    const items = task.evidence_items || [];
    const allowed = new Set(task.allowed_source_types || []);
    const invalidSourceTypes = items
      .filter((item) => allowed.size > 0 && !allowed.has(item.source_type))
      .map((item) => `${item.source_type}:${item.source_title}`);
    const validItems = items.filter((item) => invalidSourceTypes.every((invalid) => invalid !== `${item.source_type}:${item.source_title}`));
    const knowledgeSourceCount = uniqueEvidenceCount(validItems);
    const evidenceTargets = task.evidence_targets || [];
    const coveredTargets = [...new Set(validItems.flatMap((item) => item.evidence_for || []).filter(Boolean))];
    const missingTargets = evidenceTargets.filter((target) => !coveredTargets.includes(target));
    const certaintyLevels = [...new Set(validItems.map((item) => item.certainty))];
    const minKnowledgeSources = Math.max(0, Math.round(task.min_knowledge_sources ?? 1));
    const ready = invalidSourceTypes.length === 0 && knowledgeSourceCount >= minKnowledgeSources && missingTargets.length === 0;

    return {
      title: task.title,
      category: task.category,
      knowledge_angle: task.knowledge_angle || null,
      ready,
      knowledge_source_count: knowledgeSourceCount,
      min_knowledge_sources: minKnowledgeSources,
      covered_targets: coveredTargets,
      missing_targets: missingTargets,
      certainty_levels: certaintyLevels,
      invalid_source_types: invalidSourceTypes,
      remaining_queries: (task.search_packets || [])
        .filter((packet) => !validItems.some((item) => item.source_type === packet.source_type))
        .map((packet) => ({
          source_type: packet.source_type,
          query_variants: packet.query_variants.slice(0, 3),
        })),
    };
  });

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    ready_count: report.filter((item) => item.ready).length,
    task_count: report.length,
    report,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
