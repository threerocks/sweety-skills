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
  knowledge_angle?: string | null;
  min_knowledge_sources?: number;
  evidence_targets?: string[];
  search_packets?: SearchPacket[];
  notes?: string[];
}

interface SearchPayload {
  tasks?: SearchTask[];
}

interface FetchJob {
  job_id: string;
  topic_title: string;
  category: string;
  knowledge_angle: string | null;
  source_type: string;
  priority_order: number;
  goal: string;
  query_variants: string[];
  evidence_targets: string[];
  research_note_path: string;
  notes: string[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun prepare-knowledge-fetch-jobs.ts --input knowledge-search.json [--research-dir research/core-knowledge] [--output knowledge-fetch-jobs.json]

把核心知识层检索输入展开成可直接执行的抓取任务清单。`);
  process.exit(1);
}

function readInput(filePath: string): SearchTask[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SearchTask[] | SearchPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
  throw new Error("Input JSON must be an array or an object with a tasks array");
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

function sourceTag(sourceType: string): string {
  const table: Record<string, string> = {
    "百科全书类资料": "encyclopedia",
    "论文/综述/学术期刊": "paper",
    "可追溯作者与出处的杂志科普或专业栏目": "magazine",
    "教材/课程资料/教辅": "textbook",
    "经过认证的培训资料、教育资料、机构公开教学材料": "education",
  };
  return table[sourceType] || "knowledge";
}

function buildNotePath(researchDir: string, title: string, packet: SearchPacket): string {
  const topicDir = path.join(path.resolve(researchDir), slugify(title));
  const fileName = `${String(packet.priority_order).padStart(2, "0")}-${sourceTag(packet.source_type)}.md`;
  return path.join(topicDir, fileName);
}

function buildJob(task: SearchTask, packet: SearchPacket, researchDir: string): FetchJob {
  const notePath = buildNotePath(researchDir, task.title, packet);
  return {
    job_id: `${slugify(task.title)}-${String(packet.priority_order).padStart(2, "0")}-${sourceTag(packet.source_type)}`,
    topic_title: task.title,
    category: task.category,
    knowledge_angle: task.knowledge_angle || null,
    source_type: packet.source_type,
    priority_order: packet.priority_order,
    goal: packet.goal,
    query_variants: (packet.query_variants || []).slice(0, 5),
    evidence_targets: task.evidence_targets || [],
    research_note_path: notePath,
    notes: task.notes || [],
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  const researchDir = getArg("--research-dir") || "research/core-knowledge";
  if (!input) printUsage();

  const tasks = readInput(path.resolve(input));
  const jobs = tasks.flatMap((task) => (task.search_packets || []).map((packet) => buildJob(task, packet, researchDir)));
  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    research_dir: path.resolve(researchDir),
    job_count: jobs.length,
    jobs,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
