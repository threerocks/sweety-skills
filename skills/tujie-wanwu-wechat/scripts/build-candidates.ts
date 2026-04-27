import fs from "node:fs";
import path from "node:path";

interface RawCandidate {
  title: string;
  category: string;
  freshness?: number;
  spread?: number;
  depth?: number;
  humanity?: number;
  practical?: boolean | number;
  scarcity?: boolean | number;
  resonance?: boolean | number;
  verified_sources?: number;
  support_sources?: number;
  knowledge_sources?: number;
  explain_points?: string[] | number;
  safe?: boolean;
  content_fit?: boolean;
  content_flags?: string[];
  discovery_source_types?: string[];
  requires_core_knowledge?: boolean;
  min_knowledge_sources?: number;
  preferred_knowledge_source_types?: string[];
  knowledge_queries?: string[];
  knowledge_angle?: string;
  notes?: string[];
}

interface BuiltCandidate {
  title: string;
  category: string;
  score: number;
  freshness: number;
  spread: number;
  depth: number;
  humanity: number;
  verified: boolean;
  explainable: boolean;
  safe: boolean;
  content_fit: boolean;
  discovery_source_types: string[];
  requires_core_knowledge: boolean;
  min_knowledge_sources: number;
  core_knowledge_ready: boolean;
  needs_knowledge_enrichment: boolean;
  preferred_knowledge_source_types: string[];
  knowledge_queries: string[];
  knowledge_angle: string;
  knowledge_depth_ok: boolean;
  notes: string[];
  knowledge_gaps: string[];
  dropped_reasons: string[];
}

interface CandidatePayload {
  candidates: RawCandidate[];
  minSupportSources: number;
  mode?: string | null;
  query?: string | null;
  url?: string | null;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function clampScore(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(30, Math.round(value!)));
}

function clampSubScore(value: number | undefined, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value!)));
}

function normalizeBooleanScore(value: boolean | number | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return false;
}

function explainPointCount(value: string[] | number | undefined): number {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (typeof value === "number") return Math.max(0, Math.round(value));
  return 0;
}

function readInput(filePath: string): CandidatePayload {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as
    | RawCandidate[]
    | { candidates?: RawCandidate[]; topics?: RawCandidate[]; min_support_sources?: number; mode?: string; query?: string; url?: string };
  if (Array.isArray(parsed)) {
    return { candidates: parsed, minSupportSources: 2 };
  }
  if (parsed && Array.isArray(parsed.candidates)) {
    return {
      candidates: parsed.candidates,
      minSupportSources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
      mode: parsed.mode ?? null,
      query: parsed.query ?? null,
      url: parsed.url ?? null,
    };
  }
  if (parsed && Array.isArray(parsed.topics)) {
    return {
      candidates: parsed.topics,
      minSupportSources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
      mode: parsed.mode ?? null,
      query: parsed.query ?? null,
      url: parsed.url ?? null,
    };
  }
  throw new Error("Input JSON must be an array or an object with a candidates array");
}

function buildCandidate(item: RawCandidate, minSupportSources: number): BuiltCandidate {
  const freshness = clampSubScore(item.freshness, 30);
  const spread = clampSubScore(item.spread, 30);
  const depth = clampSubScore(item.depth, 20);
  const humanity = clampSubScore(item.humanity, 20);
  const score = freshness + spread + depth + humanity;

  const practical = normalizeBooleanScore(item.practical);
  const scarcity = normalizeBooleanScore(item.scarcity);
  const resonance = normalizeBooleanScore(item.resonance);
  const valuePassCount = [practical, scarcity, resonance].filter(Boolean).length;

  const supportSources = Math.max(
    0,
    Math.round(item.support_sources ?? item.verified_sources ?? 0),
  );
  const knowledgeSources = Math.max(0, Math.round(item.knowledge_sources ?? 0));
  const explainable = explainPointCount(item.explain_points) >= 2;
  const safe = item.safe !== false;
  const contentFit = item.content_fit !== false;
  const requiresCoreKnowledge = item.requires_core_knowledge !== false;
  const minKnowledgeSources = Math.max(0, Math.round(item.min_knowledge_sources ?? (requiresCoreKnowledge ? 1 : 0)));
  const coreKnowledgeReady = knowledgeSources >= minKnowledgeSources;
  const knowledgeAngle = (item.knowledge_angle || "").trim();
  const knowledgeDepthOk = knowledgeSources >= 1 || depth >= 12 || explainable;
  const knowledgeGaps: string[] = [];

  const droppedReasons: string[] = [];

  if (valuePassCount < 2) {
    droppedReasons.push("三大价值标准未满足至少两项");
  }
  if (supportSources < minSupportSources) {
    droppedReasons.push(`独立可信来源少于 ${minSupportSources} 个`);
  }
  if (!explainable) {
    droppedReasons.push("可解释性不足，无法支撑解释、机制、误区或实用要点");
  }
  if (!safe) {
    droppedReasons.push("平台安全性未通过");
  }
  if (!contentFit) {
    droppedReasons.push("内容净化未通过，偏营销、菜谱或促销");
  }
  if (!knowledgeAngle) {
    droppedReasons.push("缺少明确科普角度");
  }
  if (!knowledgeDepthOk) {
    droppedReasons.push("知识延展深度不足");
  }
  if (requiresCoreKnowledge && !coreKnowledgeReady) {
    knowledgeGaps.push(`核心知识层来源不足，至少还需 ${Math.max(0, minKnowledgeSources - knowledgeSources)} 个`);
  }

  return {
    title: item.title,
    category: item.category,
    score,
    freshness,
    spread,
    depth,
    humanity,
    verified: supportSources >= minSupportSources,
    explainable,
    safe,
    content_fit: contentFit,
    discovery_source_types: item.discovery_source_types || [],
    requires_core_knowledge: requiresCoreKnowledge,
    min_knowledge_sources: minKnowledgeSources,
    core_knowledge_ready: coreKnowledgeReady,
    needs_knowledge_enrichment: requiresCoreKnowledge && !coreKnowledgeReady,
    preferred_knowledge_source_types: item.preferred_knowledge_source_types || [],
    knowledge_queries: item.knowledge_queries || [],
    knowledge_angle: knowledgeAngle,
    knowledge_depth_ok: knowledgeDepthOk,
    notes: [...new Set(item.notes || [])],
    knowledge_gaps: knowledgeGaps,
    dropped_reasons: droppedReasons,
  };
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun build-candidates.ts --input raw-topics.json [--output candidates.json]

Raw candidate example:
  {
    "title": "帝王蟹哪些部位能吃",
    "category": "bio-edible",
    "freshness": 28,
    "spread": 22,
    "depth": 18,
    "humanity": 17,
    "practical": true,
    "scarcity": true,
    "resonance": true,
    "support_sources": 3,
    "knowledge_sources": 2,
    "explain_points": ["结构", "误区", "处理建议"],
    "safe": true,
    "knowledge_angle": "可食部位、风险提醒、处理逻辑"
  }`);
  process.exit(1);
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  const minSupportSourcesArg = getArg("--min-support-sources");

  if (!input) printUsage();

  const inputPath = path.resolve(input);
  const { candidates: rawCandidates, minSupportSources: minFromInput, mode, query, url } = readInput(inputPath);
  const minSupportSources = Math.max(1, Math.round(Number(minSupportSourcesArg || String(minFromInput))));
  const built = rawCandidates.map((item) => buildCandidate(item, minSupportSources));
  const accepted = built.filter((item) => item.dropped_reasons.length === 0);
  const rejected = built.filter((item) => item.dropped_reasons.length > 0);

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    mode: mode ?? null,
    query: query ?? null,
    url: url ?? null,
    min_support_sources: minSupportSources,
    candidates: built.map(({ dropped_reasons, ...rest }) => rest),
    accepted_titles: accepted.map((item) => item.title),
    rejected: rejected.map((item) => ({
      title: item.title,
      category: item.category,
      dropped_reasons: item.dropped_reasons,
    })),
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
