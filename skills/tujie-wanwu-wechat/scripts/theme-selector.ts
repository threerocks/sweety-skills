import fs from "node:fs";
import path from "node:path";

export type WorkType = "article" | "poster";

export interface ThemeFormattingDecision {
  theme: string;
  color: string | null;
  selectionMode: "explicit" | "auto";
  alternatives: string[];
  rationale: string[];
  signals: string[];
}

export interface ThemeSelectionManifestLike {
  topic?: string;
  work_type?: WorkType;
  selection?: {
    category?: string | null;
    priority_tier?: number | null;
    knowledge_angle?: string | null;
  };
  research?: {
    selected_sources?: string[];
    knowledge?: {
      ready_titles?: string[];
    };
  };
}

const ALL_THEMES = [
  "bauhaus",
  "bold-blue",
  "bold-green",
  "bold-navy",
  "bytedance",
  "chinese",
  "coffee-house",
  "elegant-blue",
  "elegant-green",
  "elegant-navy",
  "focus-blue",
  "focus-gold",
  "focus-red",
  "github",
  "ink",
  "lavender-dream",
  "magazine",
  "midnight",
  "minimal-blue",
  "minimal-gold",
  "minimal-gray",
  "minimal-navy",
  "minimal-red",
  "mint-fresh",
  "newspaper",
  "sports",
  "sspai",
  "sunset-amber",
  "terracotta",
  "wechat-native",
] as const;

type ThemeId = typeof ALL_THEMES[number];

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function safeReadJson(filePath: string): ThemeSelectionManifestLike | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ThemeSelectionManifestLike;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownFrontmatter(markdown: string): string {
  return markdown.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\s*/u, "");
}

function readTextContent(filePath: string): string {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return filePath.toLowerCase().endsWith(".html") ? stripHtml(raw) : stripMarkdownFrontmatter(raw);
  } catch {
    return "";
  }
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function countDialogueLines(text: string): number {
  const excluded = new Set(["核心观点", "结论", "提示", "注意", "小结", "总结", "说明", "http", "https", "title", "author", "summary", "digest", "推荐", "谨慎"]);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) return false;
      const match = line.match(/^(.{1,10})[：:]\s*(.+)$/u);
      if (!match) return false;
      const speaker = match[1]!.trim();
      const content = match[2]!.trim();
      if (excluded.has(speaker)) return false;
      if (content.startsWith("//")) return false;
      return content.length >= 4;
    }).length;
}

function normalizeCategory(category?: string | null, text = ""): string | null {
  const value = (category || "").trim().toLowerCase();
  if (value) return value;

  const normalizedText = text.toLowerCase();
  if (containsAny(normalizedText, ["海鲜", "可食", "别吃", "部位", "鱼", "虾", "蟹", "蘑菇"])) return "bio-edible";
  if (containsAny(normalizedText, ["动物", "植物", "器官", "物种", "观赏", "习性", "自然"])) return "animal-plant-nature";
  if (containsAny(normalizedText, ["原理", "机制", "实验", "现象", "科学", "为什么", "怎么回事"])) return "basic-science";
  if (containsAny(normalizedText, ["工具", "结构拆解", "部件", "日用品", "工作原理", "选购"])) return "tools-objects";
  if (containsAny(normalizedText, ["历史", "战役", "朝代", "来龙去脉", "事件复盘"])) return "history-events";
  if (containsAny(normalizedText, ["国漫", "剧情", "下一集", "人物关系", "结局"])) return "guoman-story";
  if (containsAny(normalizedText, ["ai", "模型", "agent", "markdown", "api", "工作流", "提示词", "代码", "技术"])) return "ai-tech";
  if (containsAny(normalizedText, ["热点", "热搜", "发布会", "突发", "争议"])) return "news-extended";
  return null;
}

function articleBaseThemes(category: string | null): ThemeId[] {
  switch (category) {
    case "bio-edible": return ["terracotta", "mint-fresh", "coffee-house"];
    case "animal-plant-nature": return ["mint-fresh", "terracotta", "coffee-house"];
    case "basic-science": return ["newspaper", "bytedance", "magazine"];
    case "tools-objects": return ["github", "sspai", "bytedance"];
    case "history-events": return ["newspaper", "magazine", "chinese"];
    case "guoman-story": return ["sports", "bauhaus", "terracotta"];
    case "ai-tech": return ["bytedance", "github", "sspai"];
    case "news-extended": return ["magazine", "bytedance", "newspaper"];
    default: return ["wechat-native", "newspaper", "terracotta"];
  }
}

function posterBaseThemes(category: string | null): ThemeId[] {
  switch (category) {
    case "bio-edible": return ["bauhaus", "focus-red", "sports"];
    case "animal-plant-nature": return ["bauhaus", "sports", "bold-green"];
    case "basic-science": return ["focus-blue", "bytedance", "bauhaus"];
    case "tools-objects": return ["bold-navy", "focus-blue", "bauhaus"];
    case "history-events": return ["chinese", "focus-red", "magazine"];
    case "guoman-story": return ["sports", "bauhaus", "focus-red"];
    case "ai-tech": return ["bytedance", "bold-blue", "focus-blue"];
    case "news-extended": return ["sports", "bytedance", "focus-red"];
    default: return ["bauhaus", "focus-blue", "sports"];
  }
}

function boost(scoreMap: Map<ThemeId, number>, themes: ThemeId[], amount: number): void {
  themes.forEach((theme) => {
    scoreMap.set(theme, (scoreMap.get(theme) || 0) + amount);
  });
}

function scoreThemes(
  workType: WorkType,
  category: string | null,
  text: string,
  knowledgeAngle: string,
  readyTitles: string[],
): ThemeFormattingDecision {
  const scoreMap = new Map<ThemeId, number>();
  ALL_THEMES.forEach((theme) => scoreMap.set(theme, 0));

  const rationales: string[] = [];
  const signals: string[] = [];

  const baseThemes = workType === "poster" ? posterBaseThemes(category) : articleBaseThemes(category);
  if (workType === "poster") {
    boost(scoreMap, [baseThemes[0]!], 10);
    boost(scoreMap, [baseThemes[1]!], 8);
    boost(scoreMap, [baseThemes[2]!], 6);
  } else {
    boost(scoreMap, [baseThemes[0]!], 7);
    boost(scoreMap, [baseThemes[1]!], 5);
    boost(scoreMap, [baseThemes[2]!], 4);
  }
  rationales.push(`基于作品类型 ${workType} 和类目 ${category || "unknown"} 设定基础主题优先级`);

  const headings = countMatches(text, /^#{1,3}\s+/gmu);
  const bulletLines = countMatches(text, /^[*-]\s+/gmu) + countMatches(text, /^\d+\.\s+/gmu);
  const charCount = text.replace(/\s+/g, "").length;
  const hasDialogue = countDialogueLines(text) >= 2;
  const lower = `${text}\n${knowledgeAngle}\n${readyTitles.join("\n")}`.toLowerCase();

  if (charCount >= 1200 || headings >= 3) {
    boost(scoreMap, ["newspaper", "magazine", "ink"], 3);
    signals.push("长文结构明显");
  }
  if (hasDialogue) {
    boost(scoreMap, ["coffee-house", "terracotta", "mint-fresh"], 4);
    signals.push("包含对话体");
  }
  if (category === "history-events" || containsAny(lower, ["历史", "来龙去脉", "节点", "战役", "朝代"])) {
    boost(scoreMap, ["newspaper", "magazine", "chinese"], 4);
    signals.push("历史/时间线信号明显");
  }
  if (containsAny(lower, ["风险", "避坑", "别吃", "提醒", "误区", "注意"])) {
    boost(scoreMap, ["terracotta", "focus-red", "bold-navy"], 3);
    signals.push("风险提醒类内容");
  }
  if (containsAny(lower, ["ai", "模型", "agent", "api", "markdown", "工作流", "代码", "技术", "算法", "芯片"])) {
    boost(scoreMap, ["bytedance", "github", "sspai", "midnight"], 4);
    signals.push("技术/AI 信号明显");
  }
  if (bulletLines >= 3 || containsAny(lower, ["步骤", "清单", "教程", "对比", "怎么做"])) {
    boost(scoreMap, ["github", "sspai", "minimal-blue", "focus-blue"], 3);
    signals.push("列表/步骤型结构明显");
  }
  if (containsAny(lower, ["海鲜", "可食", "动物", "植物", "自然", "器官", "物种", "观赏"])) {
    boost(scoreMap, ["mint-fresh", "terracotta", "coffee-house"], 3);
    signals.push("自然/生物主题");
  }
  if (containsAny(lower, ["热点", "热搜", "最新", "剧情", "爆火", "发布", "争议"])) {
    boost(scoreMap, ["sports", "bauhaus", "bytedance"], 3);
    signals.push("动态/热点题材");
  }
  if (containsAny(lower, ["中国", "古代", "故宫", "朝代", "诗人"])) {
    boost(scoreMap, ["chinese", "newspaper"], 3);
    signals.push("中文历史文化语境");
  }
  if (workType === "poster") {
    boost(scoreMap, ["bauhaus", "focus-blue", "focus-red", "sports", "bold-blue", "bold-navy"], 3);
    signals.push("贴图型作品");
  }

  const ranked = [...scoreMap.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return ALL_THEMES.indexOf(a[0]) - ALL_THEMES.indexOf(b[0]);
    })
    .map(([theme]) => theme);

  const selected = ranked[0] || (workType === "poster" ? "bauhaus" : "wechat-native");
  const alternatives = ranked.slice(1, 4);

  if (signals.length === 0) {
    signals.push("未发现强特征，使用基础主题优先级");
  }

  return {
    theme: selected,
    color: null,
    selectionMode: "auto",
    alternatives,
    rationale: uniq([...rationales, `优先信号：${signals.join("、")}`]),
    signals: uniq(signals),
  };
}

export function inferWechatFormatting(options: {
  filePath: string;
  workType: WorkType;
  manifestPath?: string;
  manifestData?: ThemeSelectionManifestLike;
  contentText?: string;
  explicitTheme?: string;
  explicitColor?: string;
}): ThemeFormattingDecision {
  if (options.explicitTheme) {
    return {
      theme: options.explicitTheme,
      color: options.explicitColor || null,
      selectionMode: "explicit",
      alternatives: [],
      rationale: ["命令行显式指定了主题，跳过自动推断"],
      signals: ["theme override"],
    };
  }

  const manifest = options.manifestData || (options.manifestPath ? safeReadJson(path.resolve(options.manifestPath)) : null);
  const fileText = options.contentText ?? readTextContent(path.resolve(options.filePath));
  const topic = manifest?.topic || "";
  const selectionCategory = manifest?.selection?.category || null;
  const knowledgeAngle = manifest?.selection?.knowledge_angle || "";
  const selectedSources = manifest?.research?.selected_sources || [];
  const readyTitles = manifest?.research?.knowledge?.ready_titles || [];
  const mergedText = [topic, knowledgeAngle, selectedSources.join(" "), readyTitles.join(" "), fileText].filter(Boolean).join("\n");
  const category = normalizeCategory(selectionCategory, mergedText);

  return scoreThemes(options.workType, category, mergedText, knowledgeAngle, readyTitles);
}
