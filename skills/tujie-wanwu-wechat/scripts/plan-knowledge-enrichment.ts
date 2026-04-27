import fs from "node:fs";
import path from "node:path";

interface CandidateItem {
  title: string;
  category: string;
  score?: number;
  content_fit?: boolean;
  explainable?: boolean;
  safe?: boolean;
  requires_core_knowledge?: boolean;
  min_knowledge_sources?: number;
  core_knowledge_ready?: boolean;
  needs_knowledge_enrichment?: boolean;
  preferred_knowledge_source_types?: string[];
  knowledge_queries?: string[];
  knowledge_angle?: string;
  knowledge_gaps?: string[];
  notes?: string[];
}

interface CandidatePayload {
  candidates?: CandidateItem[];
}

interface KnowledgePlanTask {
  title: string;
  category: string;
  score: number;
  knowledge_angle: string | null;
  required_core_knowledge: boolean;
  min_knowledge_sources: number;
  preferred_knowledge_source_types: string[];
  knowledge_queries: string[];
  evidence_targets: string[];
  certainty_policy: string[];
  notes: string[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun plan-knowledge-enrichment.ts --input candidates.json [--output knowledge-plan.json]
  npx -y bun plan-knowledge-enrichment.ts --input candidates.json --titles "题目A||题目B"

默认只为通过内容净化且需要补核心知识层的候选生成任务单。`);
  process.exit(1);
}

function readInput(filePath: string): CandidateItem[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as CandidateItem[] | CandidatePayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.candidates)) return parsed.candidates;
  throw new Error("Input JSON must be an array or an object with a candidates array");
}

function evidenceTargets(category: string): string[] {
  const table: Record<string, string[]> = {
    "bio-edible": ["外部可观察结构", "可食区域与不可食风险", "处理逻辑与误区纠正"],
    "animal-plant-nature": ["识别特征与外部结构", "习性与栖息环境", "观赏或观察建议"],
    "basic-science": ["现象定义与背景", "关键原理或机制", "误区与可验证实验"],
    "tools-objects": ["部件结构", "工作原理", "危险点与误区"],
    "history-events": ["背景与时间线", "关键节点", "影响与启示"],
    "ai-tech": ["基础概念", "核心机制", "边界与常见误解"],
    "news-extended": ["热点背景", "延展知识点", "误区澄清"],
    "guoman-story": ["当前剧情关键线索", "人物关系", "后续推理依据"],
  };
  return table[category] || ["基础定义", "关键解释点", "误区或边界"];
}

function certaintyPolicy(category: string): string[] {
  const common = [
    "优先采用百科全书、教材、综述、认证教育资料等核心知识来源",
    "若精确定名证据不足，降级为区域判断或保守表述",
    "热点层信息只能用于发现角度，不能单独支撑知识性结论",
  ];
  if (category === "bio-edible" || category === "animal-plant-nature") {
    return [
      ...common,
      "涉及器官、部位、可食判断时，至少补 1 个核心知识来源后再成稿",
    ];
  }
  if (category === "basic-science" || category === "ai-tech") {
    return [
      ...common,
      "机制和原理优先采用教材、综述、课程资料或论文支撑",
    ];
  }
  return common;
}

function parseTitleFilter(): Set<string> | null {
  const raw = getArg("--titles");
  if (!raw) return null;
  const values = raw
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(values);
}

function shouldKeepCandidate(item: CandidateItem, titleFilter: Set<string> | null, includeUnsafe: boolean): boolean {
  if (titleFilter) return titleFilter.has(item.title);
  if (item.requires_core_knowledge === false) return false;
  if (item.needs_knowledge_enrichment === false) return false;
  if (!includeUnsafe && item.content_fit === false) return false;
  if (!includeUnsafe && item.safe === false) return false;
  return true;
}

function buildTask(item: CandidateItem): KnowledgePlanTask {
  return {
    title: item.title,
    category: item.category,
    score: item.score ?? 0,
    knowledge_angle: item.knowledge_angle || null,
    required_core_knowledge: item.requires_core_knowledge !== false,
    min_knowledge_sources: Math.max(0, Math.round(item.min_knowledge_sources ?? 1)),
    preferred_knowledge_source_types: item.preferred_knowledge_source_types || [],
    knowledge_queries: item.knowledge_queries || [],
    evidence_targets: evidenceTargets(item.category),
    certainty_policy: certaintyPolicy(item.category),
    notes: [
      ...(item.knowledge_gaps || []),
      ...(item.notes || []).filter((note) => /双层信源|核心知识优先|内容净化/.test(note)),
    ],
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  const includeUnsafe = hasFlag("--include-content-rejected");
  if (!input) printUsage();

  const titleFilter = parseTitleFilter();
  const candidates = readInput(path.resolve(input));
  const tasks = candidates
    .filter((item) => shouldKeepCandidate(item, titleFilter, includeUnsafe))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map(buildTask);

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
