import fs from "node:fs";
import path from "node:path";

interface KnowledgePlanTask {
  title: string;
  category: string;
  score?: number;
  knowledge_angle?: string | null;
  required_core_knowledge?: boolean;
  min_knowledge_sources?: number;
  preferred_knowledge_source_types?: string[];
  knowledge_queries?: string[];
  evidence_targets?: string[];
  certainty_policy?: string[];
  notes?: string[];
}

interface KnowledgePlanPayload {
  tasks?: KnowledgePlanTask[];
}

interface SearchPacket {
  source_type: string;
  priority_order: number;
  query_variants: string[];
  goal: string;
}

interface SearchTask {
  title: string;
  category: string;
  score: number;
  knowledge_angle: string | null;
  min_knowledge_sources: number;
  evidence_targets: string[];
  certainty_policy: string[];
  search_packets: SearchPacket[];
  notes: string[];
}

const SOURCE_QUERY_SUFFIXES: Record<string, string[]> = {
  "百科全书类资料": ["百科", "百科全书", "权威百科"],
  "论文/综述/学术期刊": ["论文", "综述", "学术期刊"],
  "可追溯作者与出处的杂志科普或专业栏目": ["杂志 科普", "专业栏目", "作者 出处"],
  "教材/课程资料/教辅": ["教材", "课程资料", "教辅"],
  "经过认证的培训资料、教育资料、机构公开教学材料": ["认证 培训资料", "教育资料", "机构公开教学材料"],
};

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun prepare-knowledge-search.ts --input knowledge-plan.json [--output knowledge-search.json]

将核心知识补料任务单展开为按来源优先级分组的检索输入。`);
  process.exit(1);
}

function readInput(filePath: string): KnowledgePlanTask[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as KnowledgePlanTask[] | KnowledgePlanPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
  throw new Error("Input JSON must be an array or an object with a tasks array");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function buildQueryVariants(baseQueries: string[], sourceType: string): string[] {
  const suffixes = SOURCE_QUERY_SUFFIXES[sourceType] || [];
  const seeds = dedupe(baseQueries).slice(0, 2);
  const variants = [...seeds];

  for (const query of seeds) {
    for (const suffix of suffixes) {
      if (query.includes(suffix)) continue;
      variants.push(`${query} ${suffix}`.trim());
    }
  }

  return dedupe(variants).slice(0, 6);
}

function packetGoal(sourceType: string, category: string): string {
  if (sourceType === "百科全书类资料") {
    return category === "history-events" ? "确认基础背景、时间线和名词定义" : "确认基础定义、结构名称和常见分类";
  }
  if (sourceType === "论文/综述/学术期刊") {
    return "补充更高确定性的机制、定性依据或研究共识";
  }
  if (sourceType === "可追溯作者与出处的杂志科普或专业栏目") {
    return "补充面向公众可读的解释、案例和误区澄清";
  }
  if (sourceType === "教材/课程资料/教辅") {
    return "补充教学型表述、基础原理和结构梳理";
  }
  return "补充权威教学材料、培训解释和实操边界";
}

function buildSearchTask(task: KnowledgePlanTask): SearchTask {
  const preferred = task.preferred_knowledge_source_types || [];
  return {
    title: task.title,
    category: task.category,
    score: task.score ?? 0,
    knowledge_angle: task.knowledge_angle || null,
    min_knowledge_sources: Math.max(0, Math.round(task.min_knowledge_sources ?? 1)),
    evidence_targets: task.evidence_targets || [],
    certainty_policy: task.certainty_policy || [],
    search_packets: preferred.map((sourceType, index) => ({
      source_type: sourceType,
      priority_order: index + 1,
      query_variants: buildQueryVariants(task.knowledge_queries || [task.title], sourceType),
      goal: packetGoal(sourceType, task.category),
    })),
    notes: task.notes || [],
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const tasks = readInput(path.resolve(input)).map(buildSearchTask);
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
