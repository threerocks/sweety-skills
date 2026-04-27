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
  research_note_path: string | null;
  notes?: string[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun parse-knowledge-url-seeds.ts --input knowledge-url-seeds.md [--output knowledge-url-seeds.json]

从 Markdown 清单中回读可编辑种子块，恢复成 JSON。`);
  process.exit(1);
}

function parseBlock(block: string): SeedItem | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "<!-- seed:start" && line !== "seed:end -->");

  const record = new Map<string, string>();
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    record.set(key, value);
  }

  const jobId = record.get("job_id") || "";
  const topicTitle = record.get("topic_title") || "";
  if (!jobId || !topicTitle) return null;

  const extraNotes = record.get("extra_notes") || "";
  return {
    job_id: jobId,
    topic_title: topicTitle,
    category: record.get("category") || "",
    source_type: record.get("source_type") || "",
    priority_order: record.get("priority_order") ? Number(record.get("priority_order")) : null,
    source_label: record.get("source_label") || "",
    source_title: record.get("source_title") || "",
    source_url: record.get("source_url") || "",
    research_note_path: record.get("research_note_path") || null,
    notes: extraNotes ? [extraNotes] : [],
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const content = fs.readFileSync(path.resolve(input), "utf8");
  const blocks = [...content.matchAll(/<!-- seed:start[\s\S]*?seed:end -->/g)].map((match) => match[0]);
  const seeds = blocks.map(parseBlock).filter((item): item is SeedItem => Boolean(item));

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    seed_count: seeds.length,
    seeds,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
