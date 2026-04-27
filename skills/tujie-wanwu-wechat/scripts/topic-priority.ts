import fs from "node:fs";
import path from "node:path";

type Tier = 1 | 2 | 3;

interface TopicCandidate {
  title: string;
  category: string;
  score?: number;
  freshness?: number;
  spread?: number;
  depth?: number;
  humanity?: number;
  verified?: boolean;
  explainable?: boolean;
  safe?: boolean;
  content_fit?: boolean;
  requires_core_knowledge?: boolean;
  min_knowledge_sources?: number;
  core_knowledge_ready?: boolean;
  needs_knowledge_enrichment?: boolean;
  preferred_knowledge_source_types?: string[];
  knowledge_queries?: string[];
  knowledge_angle?: string;
  knowledge_depth_ok?: boolean;
  support_sources?: number;
  explain_points?: string[] | number;
}

interface EvaluatedCandidate extends TopicCandidate {
  normalized_category: string;
  priority_tier: Tier;
  accepted: boolean;
  reasons: string[];
}

interface CandidatePayload {
  candidates: TopicCandidate[];
  minSupportSources: number;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun topic-priority.ts --input candidates.json [--limit 2]

Input JSON:
  [
    {
      "title": "帝王蟹哪些部位能吃",
      "category": "bio-edible",
      "score": 92,
      "verified": true,
      "explainable": true,
      "safe": true,
      "knowledge_angle": "可食部位与风险提醒"
    }
  ]`);
  process.exit(1);
}

function normalizeCategory(input: string): { key: string; tier: Tier } {
  const value = input.trim().toLowerCase();
  const table: Array<{ aliases: string[]; key: string; tier: Tier }> = [
    {
      aliases: ["bio-edible", "food-edible", "生物", "海鲜", "食物可食部位", "可食部位", "海鲜可食部位"],
      key: "bio-edible",
      tier: 1,
    },
    {
      aliases: ["animal-plant-nature", "动物", "植物", "器官", "身体结构", "习性", "在哪观赏", "动物植物器官结构"],
      key: "animal-plant-nature",
      tier: 1,
    },
    {
      aliases: ["basic-science", "基础科学", "物理小实验", "化学原理", "自然现象"],
      key: "basic-science",
      tier: 1,
    },
    {
      aliases: ["tools-objects", "器物", "工具", "日用品", "器物工具", "结构拆解"],
      key: "tools-objects",
      tier: 2,
    },
    {
      aliases: ["history-events", "历史", "历史事件", "历史上的今天"],
      key: "history-events",
      tier: 2,
    },
    {
      aliases: ["guoman-story", "国漫", "国漫剧情", "人物关系", "结局走向", "最新剧情解读"],
      key: "guoman-story",
      tier: 3,
    },
    {
      aliases: ["ai-tech", "ai", "ai技术", "技术原理", "新技术", "技术机制"],
      key: "ai-tech",
      tier: 3,
    },
    {
      aliases: ["news-extended", "热点新闻延展科普", "热点延展", "热点科普"],
      key: "news-extended",
      tier: 3,
    },
  ];

  for (const item of table) {
    if (item.aliases.includes(value)) {
      return { key: item.key, tier: item.tier };
    }
  }

  throw new Error(`Unknown category: ${input}`);
}

function readCandidates(filePath: string): CandidatePayload {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as
    | TopicCandidate[]
    | { candidates?: TopicCandidate[]; topics?: TopicCandidate[]; min_support_sources?: number };
  if (Array.isArray(parsed)) {
    return { candidates: parsed, minSupportSources: 2 };
  }
  if (parsed && Array.isArray(parsed.candidates)) {
    return {
      candidates: parsed.candidates,
      minSupportSources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
    };
  }
  if (parsed && Array.isArray(parsed.topics)) {
    return {
      candidates: parsed.topics,
      minSupportSources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
    };
  }
  throw new Error("Input JSON must be an array or an object with a candidates/topics array");
}

function evaluateCandidate(candidate: TopicCandidate, minSupportSources: number): EvaluatedCandidate {
  const normalized = normalizeCategory(candidate.category);
  const reasons: string[] = [];
  const verified = candidate.verified ?? ((candidate.support_sources ?? 0) >= minSupportSources);
  const explainable = candidate.explainable ?? (
    Array.isArray(candidate.explain_points)
      ? candidate.explain_points.filter(Boolean).length >= 2
      : typeof candidate.explain_points === "number"
        ? candidate.explain_points >= 2
        : false
  );
  const safe = candidate.safe ?? true;
  const contentFit = candidate.content_fit ?? true;
  const score = candidate.score ?? (
    (candidate.freshness ?? 0) +
    (candidate.spread ?? 0) +
    (candidate.depth ?? 0) +
    (candidate.humanity ?? 0)
  );

  if (!verified) reasons.push("事实门槛未通过");
  if (!explainable) reasons.push("不可解释，难以做成科普");
  if (!safe) reasons.push("平台安全性未通过");
  if (!contentFit) reasons.push("内容净化未通过，偏营销、菜谱或促销");

  if (normalized.tier === 3) {
    if (!candidate.knowledge_angle || !candidate.knowledge_angle.trim()) {
      reasons.push("第三优先级话题缺少明确科普角度");
    }
    if (candidate.knowledge_depth_ok === false) {
      reasons.push("第三优先级话题知识延展深度不足");
    }
  }

  return {
    ...candidate,
    score,
    verified,
    explainable,
    safe,
    normalized_category: normalized.key,
    priority_tier: normalized.tier,
    accepted: reasons.length === 0,
    reasons,
  };
}

function main(): void {
  const input = getArg("--input");
  const limit = Number(getArg("--limit") || "2");
  const minSupportSourcesArg = getArg("--min-support-sources");

  if (!input) printUsage();

  const inputPath = path.resolve(input);
  const { candidates: rawCandidates, minSupportSources: minFromInput } = readCandidates(inputPath);
  const minSupportSources = Math.max(1, Math.round(Number(minSupportSourcesArg || String(minFromInput))));
  const candidates = rawCandidates.map((candidate) => evaluateCandidate(candidate, minSupportSources));
  const valid = candidates
    .filter((item) => item.accepted)
    .sort((a, b) => {
      if (a.priority_tier !== b.priority_tier) return a.priority_tier - b.priority_tier;
      return b.score - a.score;
    });

  const selected = valid.slice(0, limit);
  const bestTier = selected.length > 0 ? selected[0]!.priority_tier : null;

  const rejected = candidates
    .filter((candidate) => !selected.some((item) => item.title === candidate.title && item.normalized_category === candidate.normalized_category))
    .map((candidate) => {
      const reasons = [...candidate.reasons];
      if (candidate.accepted && bestTier !== null && candidate.priority_tier > bestTier) {
        reasons.push(`存在更高优先级可发布话题，当前优先级为第${candidate.priority_tier}档`);
      }
      if (candidate.accepted && bestTier !== null && candidate.priority_tier === bestTier && selected.length >= limit) {
        reasons.push("同优先级下分数不足，未进入最终名额");
      }
      return {
        ...candidate,
        accepted: false,
        reasons,
      };
    });

  console.log(JSON.stringify({
    ok: true,
    limit,
    selected: selected.map((item) => ({
      title: item.title,
      category: item.normalized_category,
      priority_tier: item.priority_tier,
      score: item.score,
      needs_knowledge_enrichment: item.needs_knowledge_enrichment ?? false,
      preferred_knowledge_source_types: item.preferred_knowledge_source_types || [],
      knowledge_queries: item.knowledge_queries || [],
      knowledge_angle: item.knowledge_angle || null,
    })),
    rejected: rejected.map((item) => ({
      title: item.title,
      category: item.normalized_category,
      priority_tier: item.priority_tier,
      score: item.score,
      reasons: item.reasons,
    })),
  }, null, 2));
}

main();
