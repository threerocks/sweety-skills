import fs from "node:fs";
import path from "node:path";

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

interface ExecutionPayload {
  pending?: PendingJob[];
  failed?: FailedJob[];
}

interface SeedTemplateItem {
  job_id: string;
  topic_title: string;
  category: string;
  source_type: SourceType;
  priority_order: number | null;
  source_label: string;
  source_title: string;
  source_url: string;
  recommended_domains: string[];
  recommended_search_queries: string[];
  query_variants: string[];
  goal: string;
  evidence_targets: string[];
  research_note_path: string | null;
  fill_rules: string[];
  notes: string[];
}

const DEFAULT_RECOMMENDED_DOMAINS: Record<SourceType, string[]> = {
  "百科全书类资料": ["baike.baidu.com", "zh.wikipedia.org", "britannica.com"],
  "论文/综述/学术期刊": ["scholar.google.com", "pubmed.ncbi.nlm.nih.gov", "nature.com", "sciencedirect.com", "arxiv.org"],
  "可追溯作者与出处的杂志科普或专业栏目": ["nationalgeographic.com", "scientificamerican.com", "bbc.com", "thepaper.cn", "36kr.com"],
  "教材/课程资料/教辅": ["pep.com.cn", "icourse163.org", "xuetangx.com", "cnki.net"],
  "经过认证的培训资料、教育资料、机构公开教学材料": ["who.int", "fao.org", "nih.gov", "cdc.gov", "edu.cn"],
};

const CATEGORY_DOMAIN_HINTS: Record<string, Partial<Record<SourceType, string[]>>> = {
  "bio-edible": {
    "百科全书类资料": ["britannica.com", "baike.baidu.com", "zh.wikipedia.org"],
    "论文/综述/学术期刊": ["pubmed.ncbi.nlm.nih.gov", "sciencedirect.com", "springer.com"],
    "可追溯作者与出处的杂志科普或专业栏目": ["nationalgeographic.com", "smithsonianmag.com", "thepaper.cn"],
    "教材/课程资料/教辅": ["pep.com.cn", "icourse163.org"],
    "经过认证的培训资料、教育资料、机构公开教学材料": ["fao.org", "who.int", "edu.cn"],
  },
  "animal-plant-nature": {
    "百科全书类资料": ["britannica.com", "baike.baidu.com", "zh.wikipedia.org"],
    "论文/综述/学术期刊": ["pubmed.ncbi.nlm.nih.gov", "nature.com", "sciencedirect.com"],
    "可追溯作者与出处的杂志科普或专业栏目": ["nationalgeographic.com", "scientificamerican.com", "bbc.com"],
    "教材/课程资料/教辅": ["pep.com.cn", "xuetangx.com"],
    "经过认证的培训资料、教育资料、机构公开教学材料": ["who.int", "edu.cn", "fao.org"],
  },
  "basic-science": {
    "百科全书类资料": ["britannica.com", "baike.baidu.com"],
    "论文/综述/学术期刊": ["nature.com", "sciencedirect.com", "arxiv.org"],
    "可追溯作者与出处的杂志科普或专业栏目": ["scientificamerican.com", "nature.com", "bbc.com"],
    "教材/课程资料/教辅": ["pep.com.cn", "icourse163.org", "xuetangx.com"],
    "经过认证的培训资料、教育资料、机构公开教学材料": ["edu.cn", "who.int"],
  },
  "history-events": {
    "百科全书类资料": ["zh.wikipedia.org", "britannica.com", "baike.baidu.com"],
    "论文/综述/学术期刊": ["jstor.org", "cambridge.org", "oup.com"],
    "可追溯作者与出处的杂志科普或专业栏目": ["thepaper.cn", "bbc.com", "nationalgeographic.com"],
    "教材/课程资料/教辅": ["pep.com.cn", "cnki.net"],
    "经过认证的培训资料、教育资料、机构公开教学材料": ["edu.cn", "unesco.org"],
  },
  "ai-tech": {
    "百科全书类资料": ["zh.wikipedia.org", "baike.baidu.com"],
    "论文/综述/学术期刊": ["arxiv.org", "scholar.google.com", "nature.com"],
    "可追溯作者与出处的杂志科普或专业栏目": ["blog.google", "openai.com", "microsoft.com", "36kr.com"],
    "教材/课程资料/教辅": ["xuetangx.com", "icourse163.org"],
    "经过认证的培训资料、教育资料、机构公开教学材料": ["edu.cn", "nist.gov"],
  },
};

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
  npx -y bun prepare-knowledge-url-seeds.ts --jobs knowledge-fetch-jobs.json [--execution knowledge-search-results.json] [--output knowledge-url-seeds.json]

把核心知识抓取任务或 pending 结果转成可填写的 URL 种子模板。`);
  process.exit(1);
}

function readJobs(filePath: string): FetchJob[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as FetchJob[] | FetchPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.jobs)) return parsed.jobs;
  throw new Error("Jobs JSON must be an array or an object with a jobs array");
}

function readExecution(filePath: string): ExecutionPayload {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ExecutionPayload;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function recommendedDomains(job: FetchJob): string[] {
  const categoryHints = CATEGORY_DOMAIN_HINTS[job.category]?.[job.source_type] || [];
  const defaults = DEFAULT_RECOMMENDED_DOMAINS[job.source_type] || [];
  return uniq([...categoryHints, ...defaults]).slice(0, 5);
}

function buildSearchQueries(domains: string[], queries: string[]): string[] {
  const baseQueries = queries.slice(0, 3);
  const result: string[] = [];
  for (const domain of domains.slice(0, 3)) {
    for (const query of baseQueries) {
      result.push(`site:${domain} ${query}`);
    }
  }
  return uniq(result).slice(0, 6);
}

function fillRules(sourceType: SourceType): string[] {
  if (sourceType === "百科全书类资料") {
    return [
      "优先填写权威百科词条页，不要填聚合页或问答页",
      "source_title 写词条标题，source_label 可写百科名称加词条名",
      "若只有概述性描述，没有结构或分类信息，不要作为首选种子",
    ];
  }
  if (sourceType === "论文/综述/学术期刊") {
    return [
      "优先填写论文落地页、期刊页、PubMed、DOI 页面，不要只填二手转载",
      "source_title 写论文或综述标题，notes 里可补 DOI 或期刊名",
      "若内容只是一篇新闻转述研究，不应归到论文层",
    ];
  }
  if (sourceType === "可追溯作者与出处的杂志科普或专业栏目") {
    return [
      "优先填写可追溯作者或机构栏目的正文页，不要填列表页或搜索页",
      "source_label 建议写站点名或栏目名，source_title 写文章标题",
      "尽量选择能直接支撑解释、案例或误区澄清的内容",
    ];
  }
  if (sourceType === "教材/课程资料/教辅") {
    return [
      "优先填写教材章节页、课程讲义页、课程资源页，不要填营销落地页",
      "source_title 写教材章节或课程主题名，notes 可补教材版本或课程名称",
      "若页面只有课程介绍，没有知识正文，不要作为首选种子",
    ];
  }
  return [
    "优先填写权威机构公开教学或培训正文页，不要填首页或目录页",
    "source_title 写材料标题，source_label 可写机构名",
    "确保内容能支撑实操边界、风险提示或标准化解释",
  ];
}

function buildSeed(job: FetchJob, failed: FailedJob[]): SeedTemplateItem {
  const retryQueries = uniq([
    ...(job.query_variants || []),
    ...failed.flatMap((item) => item.query ? [item.query] : []),
  ]).slice(0, 5);
  const domains = recommendedDomains(job);

  return {
    job_id: job.job_id,
    topic_title: job.topic_title,
    category: job.category,
    source_type: job.source_type,
    priority_order: Number.isFinite(job.priority_order) ? job.priority_order : null,
    source_label: "",
    source_title: "",
    source_url: "",
    recommended_domains: domains,
    recommended_search_queries: buildSearchQueries(domains, retryQueries),
    query_variants: retryQueries,
    goal: job.goal,
    evidence_targets: job.evidence_targets || [],
    research_note_path: job.research_note_path || null,
    fill_rules: fillRules(job.source_type),
    notes: uniq([
      ...(job.notes || []),
      `待补 URL 种子，优先补 ${job.source_type}`,
      ...failed.map((item) => item.error),
    ]),
  };
}

function main(): void {
  const jobsArg = getArg("--jobs");
  const executionArg = getArg("--execution");
  const output = getArg("--output");
  const allJobs = hasFlag("--all-jobs");
  if (!jobsArg) printUsage();

  const jobs = readJobs(path.resolve(jobsArg));
  const execution = executionArg ? readExecution(path.resolve(executionArg)) : null;
  const pendingIds = new Set((execution?.pending || []).map((item) => item.job_id));
  const failedByJob = new Map<string, FailedJob[]>();

  for (const failed of execution?.failed || []) {
    const current = failedByJob.get(failed.job_id) || [];
    current.push(failed);
    failedByJob.set(failed.job_id, current);
  }

  const selectedJobs = execution && !allJobs
    ? jobs.filter((job) => pendingIds.has(job.job_id) || failedByJob.has(job.job_id))
    : jobs;

  const seeds = selectedJobs.map((job) => buildSeed(job, failedByJob.get(job.job_id) || []));
  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    seed_count: seeds.length,
    seeds,
  };

  if (output) {
    const outputPath = path.resolve(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
