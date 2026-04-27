import fs from "node:fs";
import path from "node:path";

interface ScanItem {
  title: string;
  summary?: string;
  source_name?: string;
  source_url?: string;
  published_at?: string;
  category_hint?: string;
  knowledge_angle?: string;
  source_count?: number;
  official_source_count?: number;
  engagement_hint?: number;
  notes?: string[];
}

interface RawCandidate {
  title: string;
  category: string;
  freshness: number;
  spread: number;
  depth: number;
  humanity: number;
  practical: boolean;
  scarcity: boolean;
  resonance: boolean;
  support_sources: number;
  knowledge_sources: number;
  explain_points: string[];
  safe: boolean;
  content_fit: boolean;
  content_flags: string[];
  discovery_source_types: string[];
  requires_core_knowledge: boolean;
  min_knowledge_sources: number;
  preferred_knowledge_source_types: string[];
  knowledge_queries: string[];
  knowledge_angle: string;
  notes: string[];
}

interface ScanPayload {
  items?: ScanItem[];
  topics?: ScanItem[];
  mode?: string;
  query?: string;
  url?: string;
  min_support_sources?: number;
}

interface InputContext {
  mode?: string;
  query?: string;
  url?: string;
  min_support_sources: number;
}

const FIXED_KNOWLEDGE_SOURCE_PRIORITY = [
  "百科全书类资料",
  "论文/综述/学术期刊",
  "可追溯作者与出处的杂志科普或专业栏目",
  "教材/课程资料/教辅",
  "经过认证的培训资料、教育资料、机构公开教学材料",
];

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun collect-topics.ts --input scan-results.json [--output raw-topics.json]

Scan item example:
  {
    "title": "帝王蟹哪些部位能吃",
    "summary": "海鲜处理与可食部位讨论热度上升",
    "source_name": "Google News",
    "source_url": "https://example.com",
    "published_at": "2026-03-26T08:00:00+08:00",
    "knowledge_angle": "可食部位、风险提醒、处理逻辑",
    "source_count": 3,
    "official_source_count": 1,
    "engagement_hint": 80
  }`);
  process.exit(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readInput(filePath: string): { items: ScanItem[]; context: InputContext } {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ScanItem[] | ScanPayload;
  if (Array.isArray(parsed)) {
    return {
      items: parsed,
      context: { min_support_sources: 2 },
    };
  }
  if (parsed.items && Array.isArray(parsed.items)) {
    return {
      items: parsed.items,
      context: {
        mode: parsed.mode,
        query: parsed.query,
        url: parsed.url,
        min_support_sources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
      },
    };
  }
  if (parsed.topics && Array.isArray(parsed.topics)) {
    return {
      items: parsed.topics,
      context: {
        mode: parsed.mode,
        query: parsed.query,
        url: parsed.url,
        min_support_sources: Math.max(1, Math.round(parsed.min_support_sources ?? 2)),
      },
    };
  }
  throw new Error("Input JSON must be an array or an object with items/topics");
}

function hoursSince(publishedAt?: string): number | null {
  if (!publishedAt) return null;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  return Math.abs(Date.now() - published.getTime()) / 36e5;
}

function inferCategory(item: ScanItem): string {
  const hint = (item.category_hint || "").toLowerCase();
  if (hint) return hint;

  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  const checks: Array<[string, string[]]> = [
    ["bio-edible", ["海鲜", "可食", "能吃", "别吃", "虾", "蟹", "鱼", "贝", "内脏", "沙线", "苦胆", "食材"]],
    ["animal-plant-nature", ["动物", "植物", "器官", "习性", "栖息", "观赏", "花", "鸟", "鱼类", "哺乳", "昆虫"]],
    ["basic-science", ["为什么", "原理", "物理", "化学", "现象", "实验", "散射", "气压", "光线", "磁", "电"]],
    ["tools-objects", ["工具", "器物", "日用品", "部件", "结构", "拆解", "刀", "锅", "插头", "电器"]],
    ["history-events", ["历史", "战役", "条约", "王朝", "革命", "历史上的今天", "事件回顾"]],
    ["guoman-story", ["国漫", "剧情", "角色", "人物关系", "下一集", "结局", "番剧"]],
    ["ai-tech", ["ai", "gemini", "gpt", "模型", "算法", "大模型", "工作流", "技术发布"]],
  ];

  for (const [category, keywords] of checks) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }

  return "news-extended";
}

function freshnessScore(item: ScanItem): number {
  const hours = hoursSince(item.published_at);
  if (hours === null) return 12;
  if (hours <= 6) return 30;
  if (hours <= 24) return 24;
  if (hours <= 72) return 18;
  if (hours <= 168) return 12;
  return 6;
}

function spreadScore(item: ScanItem): number {
  const sourceCount = item.source_count ?? 1;
  const engagement = item.engagement_hint ?? 0;
  const sourceName = (item.source_name || "").toLowerCase();

  let base = 10 + Math.min(sourceCount * 3, 12);
  if (["google news", "今日头条", "reddit", "澎湃新闻", "36氪", "虎嗅", "it之家", "财联社"].some((name) => sourceName.includes(name.toLowerCase()))) {
    base += 4;
  }
  base += Math.min(Math.round(engagement / 15), 8);
  return clamp(base, 0, 30);
}

function depthScore(category: string, angle: string): number {
  let base = 8;
  if (["bio-edible", "animal-plant-nature", "basic-science", "history-events", "tools-objects"].includes(category)) {
    base += 6;
  }
  if (angle) base += 4;
  if (["guoman-story", "ai-tech", "news-extended"].includes(category)) base -= 2;
  return clamp(base, 0, 20);
}

function humanityScore(category: string): number {
  const map: Record<string, number> = {
    "bio-edible": 18,
    "animal-plant-nature": 17,
    "basic-science": 16,
    "tools-objects": 15,
    "history-events": 15,
    "guoman-story": 14,
    "ai-tech": 12,
    "news-extended": 12,
  };
  return clamp(map[category] ?? 12, 0, 20);
}

function practicalValue(category: string, angle: string): boolean {
  return ["bio-edible", "tools-objects", "animal-plant-nature", "basic-science"].includes(category) || /误区|判断|处理|原理|结构|风险/.test(angle);
}

function scarcityValue(item: ScanItem, category: string): boolean {
  if (["bio-edible", "animal-plant-nature", "tools-objects"].includes(category)) return true;
  const text = `${item.title} ${item.summary || ""}`;
  return /误区|冷知识|一图看懂|到底|区别|哪些/.test(text);
}

function resonanceValue(category: string, angle: string): boolean {
  return ["bio-edible", "animal-plant-nature", "basic-science", "tools-objects"].includes(category) || /痛点|避坑|收藏|判断/.test(angle);
}

function explainPoints(category: string, angle: string): string[] {
  const points: string[] = [];
  if (/结构/.test(angle) || ["bio-edible", "animal-plant-nature", "tools-objects"].includes(category)) points.push("结构");
  if (/原理|机制/.test(angle) || ["basic-science", "ai-tech"].includes(category)) points.push("机制");
  if (/误区|避坑|别/.test(angle) || ["bio-edible", "tools-objects", "history-events"].includes(category)) points.push("误区");
  if (/案例|场景|观赏|下一集|观察|现象/.test(angle) || ["guoman-story", "history-events", "basic-science"].includes(category)) points.push("案例");
  if (/判断|处理|提醒|怎么|观察|实验/.test(angle) || ["bio-edible", "tools-objects", "basic-science"].includes(category)) points.push("实用要点");
  return [...new Set(points)];
}

function detectContentNoise(item: ScanItem, category: string): string[] {
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  const flags: string[] = [];

  const promotionalPatterns = [
    /低价|特价|限时|秒杀|团购|优惠|折扣|套餐|福利|来袭|速去|抢购|开业|上新/,
    /\$\d+|\d+\s*元|\d+\s*磅|\d+\s*折/,
    /生日送|到店|门店|地址|预订|订座|探店|餐厅|餐馆|私房菜|吃货/,
  ];

  const dishPatterns = [
    /三吃|砂锅焗|清蒸|爆炒|红烧|香辣|蒜蓉|火锅|刺身|拌面|羊肉炉|沸腾鱼|菜谱|做法/,
  ];

  const topicLikePatterns = [
    /哪些|能吃|可食|别吃|部位|结构|图解|原理|为什么|习性|在哪观赏|怎么判断|误区|区别/,
  ];

  if (promotionalPatterns.some((pattern) => pattern.test(text))) {
    flags.push("营销促销导向过强");
  }

  if (dishPatterns.some((pattern) => pattern.test(text))) {
    flags.push("更像菜谱或餐饮内容，不像科普选题");
  }

  if (category === "bio-edible" && !topicLikePatterns.some((pattern) => pattern.test(text))) {
    flags.push("缺少明确的可食部位或结构科普指向");
  }

  return [...new Set(flags)];
}

function inferKnowledgeAngle(item: ScanItem, category: string, context: InputContext): string {
  const direct = (item.knowledge_angle || "").trim();
  if (direct) return direct;

  const seed = `${context.query || ""} ${item.title} ${item.summary || ""}`;
  if (category === "bio-edible") {
    if (/可食|能吃|食用|部位|内脏|沙线|苦胆|虾线|蟹黄|蟹膏/.test(seed)) {
      return "外部结构、主要可食区域、不可食风险与处理提醒";
    }
    return "外部结构、处理逻辑与常见误区";
  }
  if (category === "animal-plant-nature") {
    if (/观赏|哪里看|在哪看|栖息|分布/.test(seed)) {
      return "外部特征、习性、栖息环境与观赏建议";
    }
    return "外部结构、习性、识别特征与观察重点";
  }
  if (category === "basic-science") {
    return "现象成因、关键机制、常见误区与可验证实验";
  }
  if (category === "tools-objects") {
    return "外部结构、工作原理、危险点与使用误区";
  }
  if (category === "history-events") {
    return "来龙去脉、关键节点、影响与现实启示";
  }
  if (category === "guoman-story") {
    return "人物关系、当前剧情关键信息与后续走向推理";
  }
  if (category === "ai-tech") {
    return "核心原理、使用场景、边界与常见误解";
  }
  return "热点背景、知识延展、误区澄清与实用理解";
}

function discoverySourceTypes(item: ScanItem): string[] {
  const sourceName = (item.source_name || "").toLowerCase();
  if (!sourceName) return ["未知发现来源"];
  if (sourceName.includes("google news")) return ["Google News"];
  if (sourceName.includes("reddit")) return ["Reddit"];
  if (sourceName.includes("公众号")) return ["微信公众号"];
  if (sourceName.includes("url")) return ["URL锚点"];
  if (sourceName.includes("历史上的今天")) return ["历史上的今天"];
  return [item.source_name || "未知发现来源"];
}

function requiresCoreKnowledge(category: string): boolean {
  return [
    "bio-edible",
    "animal-plant-nature",
    "basic-science",
    "tools-objects",
    "history-events",
    "ai-tech",
  ].includes(category);
}

function preferredKnowledgeSourceTypes(): string[] {
  return [...FIXED_KNOWLEDGE_SOURCE_PRIORITY];
}

function knowledgeQueries(baseText: string, category: string): string[] {
  const base = baseText.trim();
  const suffixes: Record<string, string[]> = {
    "bio-edible": ["百科 结构", "教材 可食部位", "科普 误区", "处理 风险"],
    "animal-plant-nature": ["百科 习性", "教材 器官 结构", "科普 识别特征", "观赏 栖息"],
    "basic-science": ["教材 原理", "课程资料 实验", "综述 机制", "科普 误区"],
    "tools-objects": ["教材 结构", "公开教学 工作原理", "科普 危险点", "部件 误区"],
    "history-events": ["百科 时间线", "教材 背景 影响", "科普 关键节点"],
    "ai-tech": ["综述 原理", "教材 机制", "课程资料 边界", "论文 误解"],
    "news-extended": ["百科 背景", "科普 原理", "教材 解释"],
    "guoman-story": ["人物关系 剧情梳理", "前情 提要"],
  };

  return (suffixes[category] || [])
    .map((suffix) => `${base} ${suffix}`.trim())
    .slice(0, 4);
}

function buildRawCandidate(item: ScanItem, context: InputContext): RawCandidate {
  const category = inferCategory(item);
  const angle = inferKnowledgeAngle(item, category, context);
  const contentFlags = detectContentNoise(item, category);
  const preferredSources = preferredKnowledgeSourceTypes();
  const knowledgeSeed = context.query || item.title;
  return {
    title: item.title,
    category,
    freshness: freshnessScore(item),
    spread: spreadScore(item),
    depth: depthScore(category, angle),
    humanity: humanityScore(category),
    practical: practicalValue(category, angle),
    scarcity: scarcityValue(item, category),
    resonance: resonanceValue(category, angle),
    support_sources: Math.max(item.source_count ?? 1, context.min_support_sources),
    knowledge_sources: item.official_source_count ?? 0,
    explain_points: explainPoints(category, angle),
    safe: true,
    content_fit: contentFlags.length === 0,
    content_flags: contentFlags,
    discovery_source_types: discoverySourceTypes(item),
    requires_core_knowledge: requiresCoreKnowledge(category),
    min_knowledge_sources: requiresCoreKnowledge(category) ? 1 : 0,
    preferred_knowledge_source_types: preferredSources,
    knowledge_queries: knowledgeQueries(knowledgeSeed, category),
    knowledge_angle: angle,
    notes: [
      ...(item.notes || []),
      requiresCoreKnowledge(category) ? "双层信源：需补核心知识层来源" : "双层信源：热点层即可先入候选",
      preferredSources.length > 0 ? `核心知识优先：${preferredSources.join("、")}` : "",
      ...contentFlags.map((flag) => `内容净化：${flag}`),
      item.source_name ? `发现来源：${item.source_name}` : "",
      item.source_url ? `来源链接：${item.source_url}` : "",
    ].filter(Boolean),
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  if (!input) printUsage();

  const inputPath = path.resolve(input);
  const { items, context } = readInput(inputPath);
  const topics = items.map((item) => buildRawCandidate(item, context));

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    mode: context.mode || null,
    query: context.query || null,
    url: context.url || null,
    min_support_sources: context.min_support_sources,
    topics,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
