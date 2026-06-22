type SearchResult = {
  url?: string;
  title?: string;
  description?: string;
  position?: number;
  category?: string;
};

import { mkdir } from "node:fs/promises";

type ScrapeResult = {
  url: string;
  success: boolean;
  markdown?: string;
  error?: string;
  creditsUsed?: number;
};

type Options = {
  project: string;
  line: string;
  decision: string;
  queries: string[];
  includeDomains: string[];
  excludeDomains: string[];
  scrapeUrls: string[];
  limit: number;
  scrapeTop: number;
  allowXScrape: boolean;
  tbs?: string;
  outDir: string;
};

const args = process.argv.slice(2);

function take(flag: string) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  args.splice(idx, 2);
  return value;
}

function takeAll(flag: string) {
  const values: string[] = [];
  while (args.includes(flag)) {
    const value = take(flag);
    if (value) values.push(value);
  }
  return values;
}

function has(flag: string) {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

async function loadExtend() {
  const home = process.env.HOME || "";
  const xdg = process.env.XDG_CONFIG_HOME || `${home}/.config`;
  const candidates = [
    ".sweety-skills/sweety-trend-source-intake/EXTEND.md",
    `${xdg}/sweety-skills/sweety-trend-source-intake/EXTEND.md`,
    `${home}/.sweety-skills/sweety-trend-source-intake/EXTEND.md`,
  ];
  const config: Record<string, string> = {};
  for (const file of candidates) {
    if (!(await Bun.file(file).exists())) continue;
    const body = await Bun.file(file).text();
    for (const line of body.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*?)\s*$/);
      if (match) config[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return config;
  }
  return config;
}

function isXUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com" || host === "twitter.com";
  } catch {
    return false;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

async function firecrawl(path: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.FIRECRAWL_API_KEY) headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  const response = await fetch(`https://api.firecrawl.dev/v2/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { success: false, error: text };
  }
  if (!response.ok || json.success === false) {
    throw new Error(json.error || `Firecrawl ${path} failed with HTTP ${response.status}`);
  }
  return json;
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function parseOptions(): Promise<Options> {
  const ext = await loadExtend();
  const project = take("--project") || "unspecified-project";
  const line = take("--line") || "unspecified-line";
  const decision = take("--decision") || "collect source evidence";
  const queries = takeAll("--query");
  const includeDomains = takeAll("--include-domain");
  const excludeDomains = takeAll("--exclude-domain");
  const scrapeUrls = takeAll("--scrape-url");
  const tbs = take("--tbs") || ext.default_tbs || undefined;
  const limit = parseNumber(take("--limit"), parseNumber(ext.default_limit, 10));
  const scrapeTop = parseNumber(take("--scrape-top"), 0);
  const allowXScrape = has("--allow-x-scrape") || ext.allow_x_scrape === "1";
  const outDir = take("--out") || ext.default_output_dir || `trend-source-intake/${nowStamp()}`;
  if (queries.length === 0 && scrapeUrls.length === 0) {
    throw new Error("At least one --query or --scrape-url is required");
  }
  if (includeDomains.length > 0 && excludeDomains.length > 0) {
    throw new Error("--include-domain and --exclude-domain cannot be combined");
  }
  if (args.length > 0) throw new Error(`Unknown arguments: ${args.join(" ")}`);
  return { project, line, decision, queries, includeDomains, excludeDomains, scrapeUrls, limit, scrapeTop, allowXScrape, tbs, outDir };
}

function searchBody(query: string, options: Options) {
  const body: Record<string, unknown> = {
    query,
    limit: options.limit,
    sources: [{ type: "web" }],
  };
  if (options.includeDomains.length) body.includeDomains = options.includeDomains;
  if (options.excludeDomains.length) body.excludeDomains = options.excludeDomains;
  if (options.tbs) body.tbs = options.tbs;
  return body;
}

async function runSearch(options: Options) {
  const searches: Array<{ query: string; results: SearchResult[]; creditsUsed?: number; error?: string }> = [];
  for (const query of options.queries) {
    try {
      const payload = await firecrawl("search", searchBody(query, options));
      searches.push({ query, results: payload.data?.web || [], creditsUsed: payload.creditsUsed });
    } catch (error: any) {
      searches.push({ query, results: [], error: error.message });
    }
  }
  return searches;
}

async function runScrapes(urls: string[], options: Options) {
  const scrapes: ScrapeResult[] = [];
  for (const url of urls) {
    if (isXUrl(url) && !options.allowXScrape) {
      scrapes.push({ url, success: false, error: "Skipped X/Twitter scrape; rerun with --allow-x-scrape for selected URLs." });
      continue;
    }
    try {
      const payload = await firecrawl("scrape", { url, formats: ["markdown"] });
      scrapes.push({
        url,
        success: true,
        markdown: payload.data?.markdown || "",
        creditsUsed: payload.data?.metadata?.creditsUsed ?? payload.creditsUsed,
      });
    } catch (error: any) {
      scrapes.push({ url, success: false, error: error.message });
    }
  }
  return scrapes;
}

function clip(text: string | undefined, max = 1800) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n\n[clipped ${text.length - max} chars]` : text;
}

function renderMarkdown(data: any) {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`project: ${JSON.stringify(data.project)}`);
  lines.push(`line: ${JSON.stringify(data.line)}`);
  lines.push(`decision: ${JSON.stringify(data.decision)}`);
  lines.push(`createdAt: ${JSON.stringify(data.createdAt)}`);
  lines.push(`firecrawlAuth: ${JSON.stringify(data.firecrawlAuth)}`);
  lines.push("---");
  lines.push("");
  lines.push("# Trend Source Intake");
  lines.push("");
  lines.push("## Decision");
  lines.push("");
  lines.push(`- Project: ${data.project}`);
  lines.push(`- Line: ${data.line}`);
  lines.push(`- Decision: ${data.decision}`);
  lines.push(`- Firecrawl auth: ${data.firecrawlAuth}`);
  lines.push("");
  lines.push("## Search Results");
  lines.push("");
  for (const search of data.searches) {
    lines.push(`### Query: ${search.query}`);
    if (search.error) {
      lines.push(`- ERROR: ${search.error}`);
      lines.push("");
      continue;
    }
    lines.push(`- Credits used: ${search.creditsUsed ?? "unknown"}`);
    lines.push("");
    lines.push("| # | Host | Title | URL | Description |");
    lines.push("|---|---|---|---|---|");
    for (const item of search.results) {
      lines.push(`| ${item.position ?? ""} | ${hostOf(item.url || "")} | ${(item.title || "").replace(/\|/g, "/")} | ${item.url || ""} | ${(item.description || "").replace(/\|/g, "/")} |`);
    }
    lines.push("");
  }
  lines.push("## Scraped Evidence");
  lines.push("");
  if (data.scrapes.length === 0) {
    lines.push("No URLs were scraped in full. Search snippets are discovery evidence only.");
    lines.push("");
  }
  for (const scrape of data.scrapes) {
    lines.push(`### ${scrape.url}`);
    lines.push("");
    lines.push(`- Success: ${scrape.success ? "yes" : "no"}`);
    if (scrape.creditsUsed !== undefined) lines.push(`- Credits used: ${scrape.creditsUsed}`);
    if (scrape.error) lines.push(`- Error: ${scrape.error}`);
    if (scrape.markdown) {
      lines.push("");
      lines.push("```markdown");
      lines.push(clip(scrape.markdown));
      lines.push("```");
    }
    lines.push("");
  }
  lines.push("## Safe Claims");
  lines.push("");
  lines.push("- Search snippets only prove discoverability, not factual truth.");
  lines.push("- Full scraped pages can support claims only when the claim is directly stated in the source.");
  lines.push("- Popularity, sales, inventory, personal experience, or platform recommendation must not be claimed unless directly verified.");
  lines.push("");
  lines.push("## Next Gate");
  lines.push("");
  lines.push("- Run the target project's title, opening, platform risk, visual readability, and publishing boundary gates before production or draft creation.");
  lines.push("- If the project expects automatic selection, choose one direction and record rejected candidates with reasons.");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const options = await parseOptions();
  const searches = await runSearch(options);
  const topUrls = searches.flatMap((s) => s.results.map((r) => r.url).filter(Boolean) as string[]).slice(0, options.scrapeTop);
  const scrapeUrls = unique([...options.scrapeUrls, ...topUrls]);
  const scrapes = await runScrapes(scrapeUrls, options);
  const data = {
    project: options.project,
    line: options.line,
    decision: options.decision,
    createdAt: new Date().toISOString(),
    firecrawlAuth: process.env.FIRECRAWL_API_KEY ? "env-key" : "keyless",
    searches,
    scrapes,
  };
  await mkdir(options.outDir, { recursive: true });
  await Bun.write(`${options.outDir}/source-intake.json`, JSON.stringify(data, null, 2));
  await Bun.write(`${options.outDir}/source-intake.md`, renderMarkdown(data));
  console.log(`Wrote ${options.outDir}/source-intake.md`);
  console.log(`Wrote ${options.outDir}/source-intake.json`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
