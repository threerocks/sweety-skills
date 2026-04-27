import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

type SourceType =
  | "百科全书类资料"
  | "论文/综述/学术期刊"
  | "可追溯作者与出处的杂志科普或专业栏目"
  | "教材/课程资料/教辅"
  | "经过认证的培训资料、教育资料、机构公开教学材料";

interface FetchJob {
  job_id: string;
  topic_title: string;
  category: string;
  knowledge_angle?: string | null;
  source_type: SourceType;
  priority_order: number;
  goal: string;
  query_variants: string[];
  evidence_targets?: string[];
  research_note_path?: string;
  notes?: string[];
}

interface FetchPayload {
  jobs?: FetchJob[];
}

interface SearchCandidate {
  title: string;
  url?: string;
  summary?: string;
}

interface SearchResultItem {
  topic_title: string;
  source_type: SourceType;
  source_label?: string;
  source_title: string;
  source_url: string;
  captured_at?: string;
  summary?: string;
  excerpt?: string;
  certainty_conclusion?: string;
  key_points?: string[];
  notes?: string[];
  research_note_path?: string;
}

interface PendingJob {
  job_id: string;
  topic_title: string;
  source_type: SourceType;
  reason: string;
  query_variants: string[];
}

interface FailedJob {
  job_id: string;
  topic_title: string;
  source_type: SourceType;
  query: string | null;
  error: string;
}

interface SeedItem {
  job_id?: string;
  topic_title?: string;
  source_type?: SourceType;
  source_label?: string;
  source_title?: string;
  source_url: string;
  notes?: string[];
}

interface SeedPayload {
  seeds?: SeedItem[];
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
  npx -y bun execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json [--output knowledge-search-results.json]
    [--agent-python /path/to/python] [--job-limit 3] [--max-results-per-job 1] [--source-type "可追溯作者与出处的杂志科普或专业栏目"] [--seed-file knowledge-url-seeds.json|knowledge-url-seeds.md] [--write-notes]

执行核心知识抓取任务。已接入两条路径：
  1. 公众号专业栏目自动搜索与读取
  2. 外部提供 URL 种子后的自动读取
其余未接入的来源会明确标记为 pending。`);
  process.exit(1);
}

function readJobs(filePath: string): FetchJob[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as FetchJob[] | FetchPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.jobs)) return parsed.jobs;
  throw new Error("Input JSON must be an array or an object with a jobs array");
}

function readSeeds(filePath: string): SeedItem[] {
  if (filePath.endsWith(".md")) {
    return readSeedsFromMarkdown(filePath);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SeedItem[] | SeedPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.seeds)) return parsed.seeds;
  throw new Error("Seed JSON must be an array or an object with a seeds array");
}

function parseSeedBlock(block: string): SeedItem | null {
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
    source_type: (record.get("source_type") || "") as SourceType,
    source_label: record.get("source_label") || "",
    source_title: record.get("source_title") || "",
    source_url: record.get("source_url") || "",
    notes: extraNotes ? [extraNotes] : [],
  };
}

function readSeedsFromMarkdown(filePath: string): SeedItem[] {
  const content = fs.readFileSync(filePath, "utf8");
  const blocks = [...content.matchAll(/<!-- seed:start[\s\S]*?seed:end -->/g)].map((match) => match[0]);
  return blocks
    .map(parseSeedBlock)
    .filter((item): item is SeedItem => Boolean(item))
    .filter((item) => Boolean(item.source_url));
}

function safeShell(command: string, timeoutMs = 12000): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("/bin/zsh", ["-lc", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function wechatSearch(keyword: string, limit: number, agentPython: string): SearchCandidate[] {
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
    timeout: 12000,
  });
  if (result.status !== 0 || !(result.stdout || "").trim()) return [];

  try {
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    return parsed.flatMap((item) => {
      const title = typeof item.title === "string" ? item.title : "";
      const url = typeof item.url === "string" ? item.url : undefined;
      if (!title || !url) return [];
      return [{
        title,
        url,
        summary: typeof item.summary === "string" ? item.summary : undefined,
      }];
    });
  } catch {
    return [];
  }
}

function collectReadableLines(markdown: string): string[] {
  const noisyPatterns = [
    /^-\s*\[[ x]\]/i,
    /^title:/i,
    /^url:/i,
    /^date:/i,
    /^url source:/i,
    /^published time:/i,
    /^markdown content:/i,
    /^contents$/i,
    /^main menu$/i,
    /^move to sidebar/i,
    /^navigation$/i,
    /^search$/i,
    /^appearance$/i,
    /^donate$/i,
    /^create account$/i,
    /^log in$/i,
    /^personal tools$/i,
    /^page tools$/i,
    /^article$/i,
    /^talk$/i,
    /^read$/i,
    /^view source$/i,
    /^view history$/i,
    /^from wikipedia/i,
    /^the free encyclopedia/i,
    /^this article is about/i,
    /^for other uses/i,
    /^further information:/i,
    /^see also$/i,
    /^references$/i,
    /^external links$/i,
    /^further reading$/i,
    /^categories$/i,
    /^main page$/i,
    /^contents$/i,
  ];

  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("---"))
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("|"))
    .filter((line) => !/^\[[^\]]+\]\(https?:\/\/.+\)$/.test(line))
    .filter((line) => !/^[*-]\s+\[[^\]]+\]\(https?:\/\/.+\)/.test(line))
    .filter((line) => (line.match(/\[[^\]]+\]\(https?:\/\/.+?\)/g) || []).length < 2)
    .filter((line) => !/!\[[^\]]*\]\(https?:\/\/.+\)/.test(line))
    .filter((line) => !/upload\.wikimedia\.org/i.test(line))
    .filter((line) => !/\[\[edit\]\]/i.test(line))
    .filter((line) => !/action=edit/i.test(line))
    .filter((line) => !/flash photography/i.test(line))
    .filter((line) => !noisyPatterns.some((pattern) => pattern.test(line)))
    .filter((line) => line.length >= 20)
    .filter((line) => /[\u4e00-\u9fa5A-Za-z]/.test(line));
}

function normalizeSummaryText(text: string): string {
  return text
    .replace(/\[\[(\d+)\]\]\(https?:\/\/[^)]+\)/g, "")
    .replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+([，。；：,.!?])/g, "$1")
    .trim();
}

function extractParagraphs(markdown: string): string[] {
  const cleanedLines = collectReadableLines(markdown);
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const line of cleanedLines) {
    const looksLikeNewSection = /^([A-Z][A-Za-z ]{0,40}|[一二三四五六七八九十]+、.+)$/.test(line) && buffer.length > 0;
    if (looksLikeNewSection) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
    }
    buffer.push(line);
    if (buffer.join(" ").length >= 160) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
    }
  }
  if (buffer.length > 0) paragraphs.push(buffer.join(" "));

  return paragraphs
    .map((item) => normalizeSummaryText(item))
    .filter((item) => item.length >= 40)
    .filter((item) => /[。.;:：]/.test(item) || item.split(/\s+/).length >= 8);
}

function tokenizeHints(text: string): string[] {
  const chinese = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const english = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
  return [...new Set([...chinese, ...english])];
}

function paragraphScore(paragraph: string, hintTerms: string[]): number {
  const normalized = paragraph.toLowerCase();
  let score = 0;

  for (const term of hintTerms) {
    const normalizedTerm = term.toLowerCase();
    if (!normalizedTerm) continue;
    if (normalized.includes(normalizedTerm)) score += normalizedTerm.length >= 6 ? 3 : 2;
  }

  const sciencePatterns = [
    /biolumines/i,
    /luciferin/i,
    /luciferase/i,
    /oxygen/i,
    /abdomen/i,
    /flash/i,
    /signal/i,
    /mate|mating|courtship/i,
    /warning|predator/i,
    /发光/,
    /腹部/,
    /氧/,
    /荧光素/,
    /荧光素酶/,
    /求偶/,
    /捕食者/,
    /冷光/,
    /化学反应/,
  ];
  for (const pattern of sciencePatterns) {
    if (pattern.test(paragraph)) score += 2;
  }

  if (/may refer to|可以指/i.test(paragraph)) score -= 10;
  if (/\bISBN\b|citation needed/i.test(paragraph)) score -= 4;
  return score;
}

function extractRelevantParagraph(markdown: string, job?: FetchJob, seed?: SeedItem): string {
  const paragraphs = extractParagraphs(markdown);
  const fallbackLines = collectReadableLines(markdown).slice(0, 3).join(" ");
  if (paragraphs.length === 0) return normalizeSummaryText(fallbackLines);

  const hintTerms = tokenizeHints([
    job?.topic_title || "",
    job?.knowledge_angle || "",
    ...(job?.query_variants || []),
    seed?.source_title || "",
    seed?.source_label || "",
  ].join(" "));

  const ranked = paragraphs
    .map((paragraph) => ({ paragraph, score: paragraphScore(paragraph, hintTerms) }))
    .sort((a, b) => b.score - a.score || a.paragraph.length - b.paragraph.length);

  return ranked[0]?.paragraph || normalizeSummaryText(fallbackLines);
}

function extractHeading(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function extractJinaTitle(markdown: string): string | null {
  return markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || null;
}

function extractJinaPublished(markdown: string): string | null {
  return markdown.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim() || null;
}

function readWechatArticle(url: string, agentPython: string): { markdown: string; capturedAt: string | null } {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "tujie-wechat-"));
  const toolPath = path.join(os.homedir(), ".agent-reach", "tools", "wechat-article-for-ai", "main.py");
  const result = spawnSync(agentPython, [toolPath, "--no-images", "--force", "-o", outputDir, url], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 45000,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || "公众号文章读取失败");
  }

  const files = fs.readdirSync(outputDir, { recursive: true })
    .map((item) => path.join(outputDir, String(item)))
    .filter((item) => item.endsWith(".md"))
    .sort();
  if (files.length === 0) {
    throw new Error("公众号文章读取后未生成 markdown");
  }

  const markdown = fs.readFileSync(files[0]!, "utf8");
  const capturedAt = markdown.match(/^date:\s*(.+)$/m)?.[1]?.trim() || null;
  return { markdown, capturedAt };
}

function readGenericUrl(url: string): { markdown: string; capturedAt: string | null } {
  const safeUrl = url.replace(/'/g, `'\\''`);
  const result = safeShell(`curl -sS 'https://r.jina.ai/http://${safeUrl}'`, 15000);
  if (!result.ok || !result.stdout.trim()) {
    throw new Error((result.stderr || result.stdout || "").trim() || "URL 读取失败");
  }
  return {
    markdown: result.stdout,
    capturedAt: extractJinaPublished(result.stdout),
  };
}

function isBlockedGenericMarkdown(markdown: string): boolean {
  return (
    /SecurityCompromiseError/i.test(markdown) ||
    /"code"\s*:\s*451/.test(markdown) ||
    /DDoS attack suspected/i.test(markdown) ||
    /Anonymous access to domain/i.test(markdown)
  );
}

function encyclopediaFallbackQueries(job: FetchJob, seed?: SeedItem): string[] {
  const raw = [
    seed?.source_title,
    seed?.source_label,
    job.topic_title,
    ...(job.query_variants || []),
  ]
    .filter(Boolean)
    .map((item) => String(item).replace(/[|:：\-–—]\s*.+$/, "").trim())
    .filter(Boolean);

  return [...new Set(raw)];
}

function toWikiSlug(query: string): string | null {
  const compact = query
    .replace(/[?？!！,，.。:：;；"'“”‘’()[\]{}]/g, " ")
    .replace(/\b(how|what|why|do|does|did|at|night|light|lights|up|encyclopedia|educational|education|science|原理|百科|教育|资料|图解)\b/gi, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase())
    .map((item) => item.endsWith("ies") ? `${item.slice(0, -3)}y` : item)
    .map((item) => item.endsWith("s") && item.length > 4 ? item.slice(0, -1) : item)
    .filter((item) => item.length > 2);

  if (compact.length === 0) return null;
  return compact
    .slice(0, 3)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join("_");
}

function encyclopediaFallbackUrlCandidates(job: FetchJob, seed?: SeedItem): Array<{ url: string; label: string }> {
  const rawQueries = encyclopediaFallbackQueries(job, seed);
  const candidates: Array<{ url: string; label: string }> = [];
  const seen = new Set<string>();

  const pushCandidate = (url: string, label: string): void => {
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, label });
  };

  for (const raw of rawQueries) {
    const slug = toWikiSlug(raw);
    if (slug) {
      pushCandidate(`https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`, slug.replace(/_/g, " "));
    }

    if (/firefl(y|ies)|萤火虫/i.test(raw)) {
      pushCandidate("https://en.wikipedia.org/wiki/Lampyridae", "Lampyridae");
      pushCandidate("https://zh.wikipedia.org/wiki/萤火虫", "萤火虫");
    }

    if (/bioluminescence|发光|冷光|glow|light/i.test(raw)) {
      pushCandidate("https://en.wikipedia.org/wiki/Bioluminescence", "Bioluminescence");
      pushCandidate("https://zh.wikipedia.org/wiki/生物发光", "生物发光");
    }
  }

  return candidates;
}

function resolveWikipediaSummary(job: FetchJob, seed?: SeedItem): { markdown: string; sourceUrl: string; sourceTitle: string } | null {
  for (const candidate of encyclopediaFallbackUrlCandidates(job, seed)) {
    try {
      const page = readGenericUrl(candidate.url);
      if (isBlockedGenericMarkdown(page.markdown)) continue;
      const summary = extractFirstParagraph(page.markdown);
      if (!summary || summary.length < 40 || /may refer to|可以指/i.test(summary)) continue;
      return {
        markdown: page.markdown,
        sourceUrl: candidate.url,
        sourceTitle: candidate.label,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function readEncyclopediaWithFallback(job: FetchJob, seed: SeedItem): { markdown: string; capturedAt: string | null; sourceUrl: string; sourceTitle?: string; notes: string[] } {
  try {
    const primary = readGenericUrl(seed.source_url);
    if (isBlockedGenericMarkdown(primary.markdown)) {
      throw new Error("原始百科源被限流或拦截");
    }
    return {
      markdown: primary.markdown,
      capturedAt: primary.capturedAt,
      sourceUrl: seed.source_url,
      sourceTitle: seed.source_title,
      notes: [],
    };
  } catch (primaryError) {
    const fallback = resolveWikipediaSummary(job, seed);

    if (!fallback) {
      throw primaryError;
    }

    return {
      markdown: fallback.markdown,
      capturedAt: new Date().toISOString(),
      sourceUrl: fallback.sourceUrl,
      sourceTitle: fallback.sourceTitle,
      notes: [
        `自动百科回退：${seed.source_url} 读取失败，已切换到 ${fallback.sourceUrl}`,
      ],
    };
  }
}

function buildResultFromMarkdown(job: FetchJob, sourceType: SourceType, sourceUrl: string, markdown: string, seed?: SeedItem, query?: string): SearchResultItem {
  const heading = extractHeading(markdown) || extractJinaTitle(markdown) || seed?.source_label || seed?.source_title || job.topic_title;
  const sourceTitle = seed?.source_title || extractJinaTitle(markdown) || heading;
  const summary = extractRelevantParagraph(markdown, job, seed);

  return {
    topic_title: job.topic_title,
    source_type: sourceType,
    source_label: heading,
    source_title: sourceTitle,
    source_url: sourceUrl,
    captured_at: seed?.notes?.find((note) => note.startsWith("captured_at:"))?.replace(/^captured_at:/, "").trim() || undefined,
    summary,
    notes: [
      `自动执行核心知识抓取任务：${job.job_id}`,
      query ? `查询词：${query}` : "输入来源：URL 种子",
      `抓取目标：${job.goal}`,
      ...(seed?.notes || []),
    ],
    research_note_path: job.research_note_path,
  };
}

function matchSeed(job: FetchJob, seeds: SeedItem[]): SeedItem[] {
  return seeds.filter((seed) => {
    if (seed.job_id && seed.job_id === job.job_id) return true;
    if (seed.topic_title && seed.topic_title === job.topic_title) {
      return !seed.source_type || seed.source_type === job.source_type;
    }
    return false;
  });
}

function executeSeededJob(job: FetchJob, seeds: SeedItem[], agentPython: string, maxResultsPerJob: number): {
  results: SearchResultItem[];
  failed: FailedJob[];
} {
  const matched = matchSeed(job, seeds).slice(0, maxResultsPerJob);
  const results: SearchResultItem[] = [];
  const failed: FailedJob[] = [];

  for (const seed of matched) {
    try {
      const sourceType = seed.source_type || job.source_type;
      const reader = seed.source_url.includes("mp.weixin.qq.com")
        ? {
            ...readWechatArticle(seed.source_url, agentPython),
            sourceUrl: seed.source_url,
            sourceTitle: seed.source_title,
            notes: [] as string[],
          }
        : sourceType === "百科全书类资料"
          ? readEncyclopediaWithFallback(job, seed)
          : {
              ...readGenericUrl(seed.source_url),
              sourceUrl: seed.source_url,
              sourceTitle: seed.source_title,
              notes: [] as string[],
            };
      const item = buildResultFromMarkdown(job, sourceType, reader.sourceUrl, reader.markdown, {
        ...seed,
        source_title: reader.sourceTitle || seed.source_title,
        source_url: reader.sourceUrl,
        notes: [...(seed.notes || []), ...(reader.notes || [])],
      });
      if (reader.capturedAt) item.captured_at = reader.capturedAt;
      results.push(item);
    } catch (error) {
      failed.push({
        job_id: job.job_id,
        topic_title: job.topic_title,
        source_type: seed.source_type || job.source_type,
        query: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { results, failed };
}

function executeMagazineJob(job: FetchJob, agentPython: string, maxResultsPerJob: number): {
  results: SearchResultItem[];
  failed: FailedJob[];
} {
  const failures: FailedJob[] = [];

  for (const query of job.query_variants || []) {
    const candidates = wechatSearch(query, Math.max(1, maxResultsPerJob), agentPython);
    if (candidates.length === 0) {
      failures.push({
        job_id: job.job_id,
        topic_title: job.topic_title,
        source_type: job.source_type,
        query,
        error: "Agent-Reach 微信搜索无结果",
      });
      continue;
    }

    const results: SearchResultItem[] = [];
    for (const candidate of candidates.slice(0, maxResultsPerJob)) {
      try {
        const article = readWechatArticle(candidate.url!, agentPython);
        const item = buildResultFromMarkdown(job, job.source_type, candidate.url!, article.markdown, {
          source_title: candidate.title,
          source_label: candidate.title,
          source_url: candidate.url!,
        }, query);
        item.summary = item.summary || candidate.summary || "";
        item.captured_at = article.capturedAt || new Date().toISOString();
        results.push(item);
      } catch (error) {
        failures.push({
          job_id: job.job_id,
          topic_title: job.topic_title,
          source_type: job.source_type,
          query,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (results.length > 0) {
      return { results, failed: failures };
    }
  }

  return { results: [], failed: failures };
}

function runWriteNotes(resultsPath: string, researchDir?: string): { ok: boolean; stdout: string; stderr: string } {
  const args = ["-y", "bun", "skills/tujie-wanwu-wechat/scripts/write-knowledge-notes.ts", "--input", resultsPath];
  if (researchDir) {
    args.push("--research-dir", researchDir);
  }
  const result = spawnSync("npx", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30000,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function main(): void {
  const input = getArg("--input");
  const output = getArg("--output");
  const jobLimit = Math.max(1, Number(getArg("--job-limit") || "3"));
  const maxResultsPerJob = Math.max(1, Number(getArg("--max-results-per-job") || "1"));
  const sourceTypeFilter = getArg("--source-type") as SourceType | undefined;
  const agentPython = getArg("--agent-python") || "/Users/liulei/micromamba-agent-reach/bin/python";
  const seedFile = getArg("--seed-file");
  const writeNotes = hasFlag("--write-notes");
  const researchDir = getArg("--research-dir");
  if (!input) printUsage();
  const seeds = seedFile ? readSeeds(path.resolve(seedFile)) : [];

  const jobs = readJobs(path.resolve(input))
    .filter((job) => !sourceTypeFilter || job.source_type === sourceTypeFilter)
    .slice(0, jobLimit);

  const results: SearchResultItem[] = [];
  const pending: PendingJob[] = [];
  const failed: FailedJob[] = [];

  for (const job of jobs) {
    const seeded = executeSeededJob(job, seeds, agentPython, maxResultsPerJob);
    if (seeded.results.length > 0 || seeded.failed.length > 0) {
      results.push(...seeded.results);
      failed.push(...seeded.failed);
      if (seeded.results.length === 0) {
        pending.push({
          job_id: job.job_id,
          topic_title: job.topic_title,
          source_type: job.source_type,
          reason: "URL 种子已提供，但读取失败，需要检查网络或替换来源",
          query_variants: (job.query_variants || []).slice(0, 3),
        });
      }
      continue;
    }

    if (job.source_type !== "可追溯作者与出处的杂志科普或专业栏目") {
      pending.push({
        job_id: job.job_id,
        topic_title: job.topic_title,
        source_type: job.source_type,
        reason: "当前自动执行器只稳定接入了公众号专业栏目路径，其它核心知识来源请继续通过人工或外部检索补齐",
        query_variants: (job.query_variants || []).slice(0, 3),
      });
      continue;
    }

    const outcome = executeMagazineJob(job, agentPython, maxResultsPerJob);
    results.push(...outcome.results);
    failed.push(...outcome.failed);
    if (outcome.results.length === 0) {
      pending.push({
        job_id: job.job_id,
        topic_title: job.topic_title,
        source_type: job.source_type,
        reason: "已尝试自动抓取，但搜索无结果或文章读取失败，需要人工补充 URL 或稍后重试",
        query_variants: (job.query_variants || []).slice(0, 3),
      });
    }
  }

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    executed_job_count: jobs.length,
    result_count: results.length,
    pending_count: pending.length,
    failed_count: failed.length,
    results,
    pending,
    failed,
  };

  const outputPath = path.resolve(output || "knowledge-search-results.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  let writeNotesStatus: { ok: boolean; stdout: string; stderr: string } | null = null;
  if (writeNotes && results.length > 0) {
    writeNotesStatus = runWriteNotes(outputPath, researchDir);
  }

  console.log(JSON.stringify({
    ...payload,
    output: outputPath,
    notes_written: writeNotesStatus ? writeNotesStatus.ok : false,
    write_notes_stdout: writeNotesStatus?.stdout?.trim() || "",
    write_notes_stderr: writeNotesStatus?.stderr?.trim() || "",
  }, null, 2));
}

main();
