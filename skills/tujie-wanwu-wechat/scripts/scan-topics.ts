import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadTujieConfig } from "./tujie-config.ts";

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

interface ScanPayload {
  ok: true;
  mode: "url" | "keyword" | "hot";
  generated_at: string;
  query?: string;
  url?: string;
  min_support_sources: number;
  inferred_category?: string;
  attempted_queries?: string[];
  source_status?: Record<string, string>;
  items: ScanItem[];
}

interface RssItem {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

type SourceStatus = Record<string, string>;

const HTTP_TIMEOUT_MS = 6000;
const AGENT_TIMEOUT_MS = 6000;

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
  npx -y bun scan-topics.ts [--url <url> | --keyword <keyword> | --hot] [--limit 10] [--output scan-results.json]

Behavior:
  - URL: 读取链接内容并生成单个扫描项
  - keyword: 用 Google News RSS、微信公众号搜索、Reddit 搜索补候选
  - hot: 扫最近热点，优先 Google News，再补 Reddit 与公众号搜索线索`);
  process.exit(1);
}

function shell(command: string, timeoutMs = HTTP_TIMEOUT_MS): string {
  const result = spawnSync("/bin/zsh", ["-lc", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    const reason = (result.stderr || result.stdout || "").trim();
    throw new Error(reason || `Command failed: ${command}`);
  }
  return result.stdout || "";
}

function shellOptional(command: string, timeoutMs = HTTP_TIMEOUT_MS): string {
  try {
    return shell(command, timeoutMs);
  } catch {
    return "";
  }
}

function escapeShellSingle(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function stripCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripCdata(match[1]!.trim()) : undefined;
}

function parseRss(xml: string): RssItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return items.map((match) => {
    const block = match[1]!;
    return {
      title: extractTag(block, "title") || "",
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      description: extractTag(block, "description"),
    };
  }).filter((item) => item.title);
}

function parseJinaPage(markdown: string, fallbackUrl: string): ScanItem {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryLine = lines.find((line) => (
    !line.startsWith("Title:") &&
    !line.startsWith("URL Source:") &&
    !line.startsWith("Published Time:") &&
    !line.startsWith("Markdown Content:")
  ));
  const publishedMatch = markdown.match(/^Published Time:\s*(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() || fallbackUrl,
    summary: summaryLine,
    source_name: "URL",
    source_url: fallbackUrl,
    published_at: publishedMatch?.[1]?.trim(),
    source_count: 1,
    official_source_count: 1,
    notes: ["通过 Jina Reader 读取 URL 锚点"],
  };
}

function inferKeywordCategory(keyword: string): string {
  const text = keyword.toLowerCase();
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
    if (keywords.some((item) => text.includes(item))) return category;
  }
  return "news-extended";
}

function buildKeywordVariants(keyword: string, category: string): string[] {
  const variants = [keyword];
  const suffixTable: Record<string, string[]> = {
    "bio-edible": ["图解 可食部位", "哪些部位不能吃", "结构 误区 处理"],
    "animal-plant-nature": ["结构 习性 图解", "在哪观赏 识别特征", "器官 外部特征"],
    "basic-science": ["原理 图解", "现象 为什么", "误区 实验"],
    "tools-objects": ["结构拆解 工作原理", "危险点 误区", "部件 图解"],
    "history-events": ["来龙去脉 关键节点", "历史背景 影响", "误区 解释"],
    "guoman-story": ["人物关系 剧情解读", "结局 线索", "下一集 走向"],
    "ai-tech": ["技术原理 边界", "工作机制 场景", "误解 区别"],
    "news-extended": ["科普 原理", "误区 解读", "背景 影响"],
  };

  const base = keyword.trim();
  for (const suffix of suffixTable[category] || []) {
    const suffixParts = suffix
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !base.includes(item));
    if (suffixParts.length === 0) continue;
    variants.push(`${base} ${suffixParts.join(" ")}`);
  }

  return [...new Set(variants.map((item) => item.trim()).filter(Boolean))];
}

function detectNoiseFlags(item: ScanItem, inferredCategory: string): string[] {
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
    flags.push("更像菜谱或餐饮内容");
  }
  if (inferredCategory === "bio-edible" && !topicLikePatterns.some((pattern) => pattern.test(text))) {
    flags.push("缺少明确的可食部位或结构指向");
  }
  return flags;
}

function noiseScore(item: ScanItem, inferredCategory: string): number {
  return detectNoiseFlags(item, inferredCategory).length;
}

function selectCleanerItems(items: ScanItem[], inferredCategory: string, limit: number): ScanItem[] {
  return [...items]
    .sort((a, b) => {
      const noiseDelta = noiseScore(a, inferredCategory) - noiseScore(b, inferredCategory);
      if (noiseDelta !== 0) return noiseDelta;
      return (b.engagement_hint ?? 0) - (a.engagement_hint ?? 0);
    })
    .slice(0, limit);
}

function shouldRetryKnowledgeRound(items: ScanItem[], inferredCategory: string): boolean {
  if (items.length === 0) return true;
  const noisyItems = items.filter((item) => noiseScore(item, inferredCategory) > 0).length;
  return noisyItems / items.length >= 0.6;
}

function googleNewsSearch(keyword: string, limit: number, recentDays: number): ScanItem[] {
  const query = encodeURIComponent(`${keyword} when:${recentDays}d`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  const xml = shellOptional(`curl -sS '${url}'`);
  if (!xml.trim()) return [];
  return parseRss(xml).slice(0, limit).map((item) => ({
    title: item.title,
    summary: item.description,
    source_name: "Google News",
    source_url: item.link,
    published_at: item.pubDate,
    source_count: 2,
    official_source_count: 0,
    engagement_hint: 70,
    notes: ["Google News RSS 检索结果"],
  }));
}

function googleNewsHot(limit: number): ScanItem[] {
  const url = "https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans";
  const xml = shellOptional(`curl -sS '${url}'`);
  if (!xml.trim()) return [];
  return parseRss(xml).slice(0, limit).map((item) => ({
    title: item.title,
    summary: item.description,
    source_name: "Google News",
    source_url: item.link,
    published_at: item.pubDate,
    source_count: 2,
    official_source_count: 0,
    engagement_hint: 75,
    notes: ["Google News 热点 RSS"],
  }));
}

function redditSearch(keyword: string, limit: number): ScanItem[] {
  const encoded = encodeURIComponent(keyword);
  const json = shellOptional(`curl -sS 'https://www.reddit.com/search.json?q=${encoded}&limit=${limit}' -H 'User-Agent: agent-reach/1.0'`);
  if (!json.trim()) return [];
  try {
    const parsed = JSON.parse(json) as { data?: { children?: Array<{ data?: Record<string, unknown> }> } };
    return (parsed.data?.children || []).slice(0, limit).flatMap((entry) => {
      const data = entry.data || {};
      const title = typeof data.title === "string" ? data.title : "";
      const permalink = typeof data.permalink === "string" ? `https://www.reddit.com${data.permalink}` : undefined;
      if (!title) return [];
      return [{
        title,
        summary: typeof data.selftext === "string" ? data.selftext.slice(0, 180) : undefined,
        source_name: "Reddit",
        source_url: permalink,
        published_at: typeof data.created_utc === "number" ? new Date(data.created_utc * 1000).toISOString() : undefined,
        source_count: 1,
        official_source_count: 0,
        engagement_hint: typeof data.score === "number" ? data.score : 40,
        notes: ["Reddit 搜索结果"],
      }];
    });
  } catch {
    return [];
  }
}

function redditHot(limit: number): ScanItem[] {
  const json = shellOptional(`curl -sS 'https://www.reddit.com/r/popular/hot.json?limit=${limit}' -H 'User-Agent: agent-reach/1.0'`);
  if (!json.trim()) return [];
  try {
    const parsed = JSON.parse(json) as { data?: { children?: Array<{ data?: Record<string, unknown> }> } };
    return (parsed.data?.children || []).slice(0, limit).flatMap((entry) => {
      const data = entry.data || {};
      const title = typeof data.title === "string" ? data.title : "";
      const permalink = typeof data.permalink === "string" ? `https://www.reddit.com${data.permalink}` : undefined;
      if (!title) return [];
      return [{
        title,
        summary: typeof data.selftext === "string" ? data.selftext.slice(0, 180) : undefined,
        source_name: "Reddit",
        source_url: permalink,
        published_at: typeof data.created_utc === "number" ? new Date(data.created_utc * 1000).toISOString() : undefined,
        source_count: 1,
        official_source_count: 0,
        engagement_hint: typeof data.score === "number" ? data.score : 55,
        notes: ["Reddit 热门结果"],
      }];
    });
  } catch {
    return [];
  }
}

function wechatSearch(keyword: string, limit: number, agentPython: string): ScanItem[] {
  const code = [
    "import asyncio, json, sys",
    "from miku_ai import get_wexin_article",
    "async def main():",
    "    query=sys.argv[1]",
    "    limit=int(sys.argv[2])",
    "    items=await get_wexin_article(query, limit)",
    "    print(json.dumps(items, ensure_ascii=False))",
    "asyncio.run(main())",
  ].join("\n");

  const result = spawnSync(agentPython, ["-c", code, keyword, String(limit)], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: AGENT_TIMEOUT_MS,
  });
  if (result.status !== 0 || !(result.stdout || "").trim()) return [];

  try {
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    return parsed.slice(0, limit).flatMap((item) => {
      const title = typeof item.title === "string" ? item.title : "";
      const url = typeof item.url === "string" ? item.url : undefined;
      if (!title) return [];
      return [{
        title,
        summary: typeof item.summary === "string" ? item.summary : undefined,
        source_name: "微信公众号",
        source_url: url,
        source_count: 1,
        official_source_count: 0,
        engagement_hint: 60,
        notes: ["Agent Reach 微信公众号搜索结果"],
      }];
    });
  } catch {
    return [];
  }
}

function hotHistoryItems(): ScanItem[] {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  return [{
    title: `${month}月${day}日历史上的今天可以延展的事件`,
    summary: "把当日历史节点转成来龙去脉、误区澄清或影响解释型科普。",
    source_name: "历史上的今天",
    source_url: undefined,
    category_hint: "history-events",
    knowledge_angle: "来龙去脉、关键节点、影响与启示",
    source_count: 1,
    official_source_count: 1,
    engagement_hint: 45,
    notes: ["保底历史选题入口，需要后续补正式史料来源"],
  }];
}

function dedupe(items: ScanItem[]): ScanItem[] {
  const seen = new Set<string>();
  const result: ScanItem[] = [];
  for (const item of items) {
    const key = `${item.title}::${item.source_url || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeSourceStatus(base: SourceStatus, next: SourceStatus): SourceStatus {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next)) {
    merged[key] = merged[key] ? `${merged[key]}; ${value}` : value;
  }
  return merged;
}

function sourceSummary(items: ScanItem[], sourceName: string): string {
  return items.length > 0 ? `ok:${items.length}` : "empty";
}

function keywordRound(
  query: string,
  limit: number,
  recentDays: number,
  agentPython: string,
): { items: ScanItem[]; status: SourceStatus } {
  const googleItems = googleNewsSearch(query, limit, recentDays);
  const wechatItems = wechatSearch(query, Math.min(limit, 5), agentPython);
  const redditItems = redditSearch(query, Math.min(limit, 5));

  return {
    items: dedupe([
      ...googleItems,
      ...wechatItems,
      ...redditItems,
    ]),
    status: {
      [`google:${query}`]: sourceSummary(googleItems, "Google News"),
      [`wechat:${query}`]: sourceSummary(wechatItems, "微信公众号"),
      [`reddit:${query}`]: sourceSummary(redditItems, "Reddit"),
    },
  };
}

function main(): void {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
  }
  const config = loadTujieConfig();
  const url = getArg("--url");
  const keyword = getArg("--keyword");
  const hot = hasFlag("--hot") || (!url && !keyword);
  const output = getArg("--output");
  const limit = Number(getArg("--limit") || config.default_topic_count || "6");
  const recentDays = Number(getArg("--recent-days") || config.recent_hot_window_days || "7");
  const agentPython = getArg("--agent-python")
    || config.agent_reach_python
    || "/Users/liulei/micromamba-agent-reach/bin/python";

  if (url && keyword) printUsage();

  let items: ScanItem[] = [];
  let mode = "hot";
  let inferredCategory: string | undefined;
  const attemptedQueries: string[] = [];
  let sourceStatus: SourceStatus = {};

  if (url) {
    mode = "url";
    const escapedUrl = escapeShellSingle(url);
    const markdown = shell(`curl -sS 'https://r.jina.ai/http://${escapedUrl}'`);
    items = [parseJinaPage(markdown, url)];
  } else if (keyword) {
    mode = "keyword";
    inferredCategory = inferKeywordCategory(keyword);
    const variants = buildKeywordVariants(keyword, inferredCategory);
    const firstRound = keywordRound(variants[0]!, limit, recentDays, agentPython);
    attemptedQueries.push(variants[0]!);
    sourceStatus = mergeSourceStatus(sourceStatus, firstRound.status);
    items = firstRound.items;

    if (shouldRetryKnowledgeRound(items, inferredCategory)) {
      for (const variant of variants.slice(1, 2)) {
        const round = keywordRound(variant, limit, recentDays, agentPython);
        attemptedQueries.push(variant);
        sourceStatus = mergeSourceStatus(sourceStatus, round.status);
        items = dedupe([...items, ...round.items]);
      }
    }

    items = selectCleanerItems(items, inferredCategory, limit);
  } else if (hot) {
    mode = "hot";
    const googleItems = googleNewsHot(limit);
    const redditItems = redditHot(Math.min(limit, 5));
    const historyItems = hotHistoryItems();
    sourceStatus = {
      "google:hot": sourceSummary(googleItems, "Google News"),
      "reddit:hot": sourceSummary(redditItems, "Reddit"),
      "history:today": sourceSummary(historyItems, "历史上的今天"),
    };
    items = dedupe([
      ...googleItems,
      ...redditItems,
      ...historyItems,
    ]);
  }

  const payload: ScanPayload = {
    ok: true,
    mode,
    generated_at: new Date().toISOString(),
    query: keyword,
    url: url || undefined,
    min_support_sources: mode === "hot" ? 2 : 1,
    inferred_category: inferredCategory,
    attempted_queries: attemptedQueries.length > 0 ? attemptedQueries : undefined,
    source_status: Object.keys(sourceStatus).length > 0 ? sourceStatus : undefined,
    items: items.slice(0, limit),
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
