import fs from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

export interface CliArgs {
  prompt: string | null;
  refs: string[];
  model: string | null;
  duration: number | null;
  aspectRatio: string | null;
  output: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  statusId: number | null;
  waitId: number | null;
  retryId: number | null;
  models: boolean;
  noWait: boolean;
  noDownload: boolean;
  pollInterval: number | null;
  timeoutMinutes: number | null;
  usage: boolean;
  json: boolean;
  help: boolean;
}

export interface ExtendConfig {
  base_url?: string;
  default_model?: string;
  default_duration?: number;
  default_aspect_ratio?: string;
  poll_interval_seconds?: number;
  timeout_minutes?: number;
  price_per_point?: number;
}

export interface ResolvedConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  duration: number;
  aspectRatio: string;
  pollInterval: number;
  timeoutMinutes: number;
  pricePerPoint: number | null;
}

export interface TaskMeta {
  model: string | null;
  duration: number | null;
  aspectRatio: string | null;
  prompt: string | null;
}

interface StatusResponse {
  task_id: number;
  state: "pending" | "running" | "success" | "failed";
  status: string;
  is_final: boolean;
  progress: string;
  result_url: string;
  video_url: string;
  result_type: string;
  error: string;
  cost: number;
}

const ENV_BASE_URL = "VIDEO_GEN_BASE_URL";
const ENV_API_KEY = "VIDEO_GEN_API_KEY";
const SKILL_DIR = "sweety-video-gen";

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prompt: null,
    refs: [],
    model: null,
    duration: null,
    aspectRatio: null,
    output: null,
    baseUrl: null,
    apiKey: null,
    statusId: null,
    waitId: null,
    retryId: null,
    models: false,
    noWait: false,
    noDownload: false,
    pollInterval: null,
    timeoutMinutes: null,
    usage: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--prompt":
      case "-p":
        args.prompt = argv[++i] ?? null;
        break;
      case "--ref":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.refs.push(argv[++i]);
        }
        break;
      case "--model":
      case "-m":
        args.model = argv[++i] ?? null;
        break;
      case "--duration":
      case "-d":
        args.duration = Number(argv[++i]);
        break;
      case "--ar":
        args.aspectRatio = argv[++i] ?? null;
        break;
      case "--output":
      case "-o":
        args.output = argv[++i] ?? null;
        break;
      case "--base-url":
        args.baseUrl = argv[++i] ?? null;
        break;
      case "--api-key":
        args.apiKey = argv[++i] ?? null;
        break;
      case "--status":
        args.statusId = Number(argv[++i]);
        break;
      case "--wait":
        args.waitId = Number(argv[++i]);
        break;
      case "--retry":
        args.retryId = Number(argv[++i]);
        break;
      case "--models":
        args.models = true;
        break;
      case "--usage":
        args.usage = true;
        break;
      case "--no-wait":
        args.noWait = true;
        break;
      case "--no-download":
        args.noDownload = true;
        break;
      case "--poll-interval":
        args.pollInterval = Number(argv[++i]);
        break;
      case "--timeout-minutes":
        args.timeoutMinutes = Number(argv[++i]);
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
    }
  }
  return args;
}

export function parseExtendYaml(content: string): ExtendConfig {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const yaml = match ? match[1] : content;
  const config: ExtendConfig = {};
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!val || val === "null") continue;
    if (key === "base_url") config.base_url = val;
    if (key === "default_model") config.default_model = val;
    if (key === "default_duration") config.default_duration = Number(val);
    if (key === "default_aspect_ratio") config.default_aspect_ratio = val;
    if (key === "poll_interval_seconds") config.poll_interval_seconds = Number(val);
    if (key === "timeout_minutes") config.timeout_minutes = Number(val);
    if (key === "price_per_point") config.price_per_point = Number(val);
  }
  return config;
}

export function resolveConfig(
  args: CliArgs,
  extend: ExtendConfig,
  env: Record<string, string | undefined>,
): ResolvedConfig {
  const baseUrl = args.baseUrl ?? extend.base_url ?? env[ENV_BASE_URL] ?? "";
  const apiKey = args.apiKey ?? env[ENV_API_KEY] ?? "";
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model: args.model ?? extend.default_model ?? "video-v1",
    duration: args.duration ?? extend.default_duration ?? 10,
    aspectRatio: args.aspectRatio ?? extend.default_aspect_ratio ?? "16:9",
    pollInterval: args.pollInterval ?? extend.poll_interval_seconds ?? 15,
    timeoutMinutes: args.timeoutMinutes ?? extend.timeout_minutes ?? 30,
    pricePerPoint: extend.price_per_point ?? null,
  };
}

export function formatCost(points: number, pricePerPoint: number | null): string {
  if (pricePerPoint == null) return `${points} 积分`;
  return `${points} 积分 (≈${(points * pricePerPoint).toFixed(2)} 元)`;
}

export function joinUrl(base: string, p: string): string {
  if (/^https?:\/\//.test(p)) return p;
  return base.replace(/\/+$/, "") + (p.startsWith("/") ? p : `/${p}`);
}

export function pickDownloadUrl(status: StatusResponse): string {
  if (status.video_url) return status.video_url;
  return status.result_url;
}

export function outputPathFor(args: CliArgs, status: StatusResponse, url: string): string {
  if (args.output) return args.output;
  const ext = path.extname(new URL(url, "http://x").pathname) || (status.result_type === "image" ? ".jpg" : ".mp4");
  return `${status.result_type || "video"}-${status.task_id}${ext}`;
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function loadEnvFile(file: string): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(file, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

async function loadEnv(): Promise<void> {
  const home = homedir();
  const cwd = process.cwd();
  const homeEnv = await loadEnvFile(path.join(home, ".sweety-skills", ".env"));
  const cwdEnv = await loadEnvFile(path.join(cwd, ".sweety-skills", ".env"));
  for (const [k, v] of Object.entries(homeEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }
  for (const [k, v] of Object.entries(cwdEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

async function loadExtend(): Promise<ExtendConfig> {
  const home = homedir();
  const cwd = process.cwd();
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  const candidates = [
    path.join(cwd, ".sweety-skills", SKILL_DIR, "EXTEND.md"),
    path.join(xdg, "sweety-skills", SKILL_DIR, "EXTEND.md"),
    path.join(home, ".sweety-skills", SKILL_DIR, "EXTEND.md"),
  ];
  for (const file of candidates) {
    try {
      const content = await fs.readFile(file, "utf-8");
      return parseExtendYaml(content);
    } catch {}
  }
  return {};
}

function authHeaders(config: ResolvedConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.apiKey}` };
}

async function apiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.error || JSON.stringify(data);
  } catch {
    return await res.text().catch(() => `HTTP ${res.status}`);
  }
}

async function listModels(config: ResolvedConfig, json: boolean): Promise<void> {
  const res = await fetch(joinUrl(config.baseUrl, "/v1/models"));
  if (!res.ok) throw new Error(`查询模型列表失败: ${await apiError(res)}`);
  const data = await res.json();
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  for (const m of data.data ?? []) {
    console.log(`${m.id}\t${m.type}\t${m.display_name ?? ""}`);
  }
}

async function uploadRef(config: ResolvedConfig, file: string): Promise<string> {
  const data = await fs.readFile(file);
  const fd = new FormData();
  fd.append("file", new Blob([data], { type: contentTypeFor(file) }), path.basename(file));
  const res = await fetch(joinUrl(config.baseUrl, "/v1/media/upload"), {
    method: "POST",
    headers: authHeaders(config),
    body: fd,
  });
  if (!res.ok) throw new Error(`上传参考图失败 (${file}): ${await apiError(res)}`);
  const body = await res.json();
  const url = body.url || body.data?.url;
  if (!url) throw new Error(`上传参考图无返回地址 (${file}): ${JSON.stringify(body)}`);
  return url;
}

async function resolveRefs(config: ResolvedConfig, refs: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const ref of refs) {
    if (/^https?:\/\//.test(ref) || ref.startsWith("/uploads/")) {
      urls.push(ref);
      continue;
    }
    process.stderr.write(`上传参考图: ${ref}\n`);
    urls.push(await uploadRef(config, ref));
  }
  return urls;
}

async function createTask(config: ResolvedConfig, prompt: string, images: string[]): Promise<number> {
  const isVideo = !config.model.startsWith("image");
  const params: Record<string, unknown> = {
    aspect_ratio: config.aspectRatio,
    images,
  };
  if (isVideo) params.duration = config.duration;
  const res = await fetch(joinUrl(config.baseUrl, "/v1/media/generate"), {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, prompt, params }),
  });
  if (!res.ok) throw new Error(`创建任务失败: ${await apiError(res)}`);
  const body = await res.json();
  if (body.task_id == null) throw new Error(`创建任务无 task_id: ${JSON.stringify(body)}`);
  return body.task_id;
}

async function retryTask(config: ResolvedConfig, taskId: number): Promise<void> {
  const res = await fetch(joinUrl(config.baseUrl, "/v1/media/retry"), {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId }),
  });
  if (!res.ok) throw new Error(`重试任务失败: ${await apiError(res)}`);
}

async function queryStatus(config: ResolvedConfig, taskId: number): Promise<StatusResponse> {
  const res = await fetch(joinUrl(config.baseUrl, `/v1/media/status?task_id=${taskId}`), {
    headers: authHeaders(config),
  });
  if (!res.ok) throw new Error(`查询任务失败: ${await apiError(res)}`);
  return await res.json();
}

async function pollUntilFinal(config: ResolvedConfig, taskId: number): Promise<StatusResponse> {
  const deadline = Date.now() + config.timeoutMinutes * 60_000;
  let last = "";
  while (true) {
    const status = await queryStatus(config, taskId);
    const line = `[task ${taskId}] ${status.state} ${status.progress}`;
    if (line !== last) {
      process.stderr.write(`${line}\n`);
      last = line;
    }
    if (status.is_final) return status;
    if (Date.now() > deadline) {
      throw new Error(`任务 ${taskId} 超过 ${config.timeoutMinutes} 分钟未完成，可稍后用 --status ${taskId} 或 --wait ${taskId} 继续`);
    }
    await new Promise((r) => setTimeout(r, config.pollInterval * 1000));
  }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 (${url}): HTTP ${res.status}`);
  await fs.mkdir(path.dirname(path.resolve(dest)), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function usageLogPath(): string {
  return path.join(homedir(), ".sweety-skills", SKILL_DIR, "usage.jsonl");
}

async function logUsage(config: ResolvedConfig, status: StatusResponse, meta: TaskMeta, outputPath: string | null): Promise<void> {
  const entry = {
    ts: new Date().toISOString(),
    task_id: status.task_id,
    state: status.state,
    model: meta.model,
    duration: meta.duration,
    aspect_ratio: meta.aspectRatio,
    prompt: meta.prompt,
    cost_points: status.cost,
    est_cny: config.pricePerPoint != null ? Number((status.cost * config.pricePerPoint).toFixed(2)) : null,
    output: outputPath,
  };
  const file = usageLogPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`);
}

async function showUsage(config: ResolvedConfig, json: boolean): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(usageLogPath(), "utf-8");
  } catch {}
  const entries = content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const success = entries.filter((e) => e.state === "success");
  const points = success.reduce((sum, e) => sum + (e.cost_points ?? 0), 0);
  if (json) {
    console.log(JSON.stringify({ total: entries.length, success: success.length, cost_points: points, est_cny: config.pricePerPoint != null ? Number((points * config.pricePerPoint).toFixed(2)) : null, entries }, null, 2));
    return;
  }
  for (const e of entries) {
    console.log(`${e.ts}\ttask ${e.task_id}\t${e.state}\t${e.duration ?? "?"}s\t${formatCost(e.cost_points ?? 0, config.pricePerPoint)}`);
  }
  console.log(`共 ${entries.length} 条（成功 ${success.length}），成功任务累计 ${formatCost(points, config.pricePerPoint)}`);
}

function printResult(config: ResolvedConfig, args: CliArgs, status: StatusResponse, outputPath: string | null, downloadUrl: string): void {
  if (args.json) {
    console.log(JSON.stringify({ ...status, download_url: downloadUrl, output: outputPath }, null, 2));
    return;
  }
  console.log(`task_id: ${status.task_id}`);
  console.log(`state: ${status.state}`);
  console.log(`cost: ${formatCost(status.cost, config.pricePerPoint)}`);
  if (downloadUrl) console.log(`url: ${downloadUrl}`);
  if (outputPath) console.log(`output: ${outputPath}`);
  if (status.error) console.log(`error: ${status.error}`);
}

async function finishTask(config: ResolvedConfig, args: CliArgs, taskId: number, meta: TaskMeta): Promise<void> {
  const status = await pollUntilFinal(config, taskId);
  if (status.state !== "success") {
    await logUsage(config, status, meta, null);
    printResult(config, args, status, null, "");
    throw new Error(`任务 ${taskId} 失败: ${status.error || status.status}（可用 --retry ${taskId} 重试）`);
  }
  const downloadUrl = joinUrl(config.baseUrl, pickDownloadUrl(status));
  if (args.noDownload) {
    await logUsage(config, status, meta, null);
    printResult(config, args, status, null, downloadUrl);
    return;
  }
  const outputPath = outputPathFor(args, status, downloadUrl);
  await download(downloadUrl, outputPath);
  await logUsage(config, status, meta, outputPath);
  printResult(config, args, status, outputPath, downloadUrl);
}

const HELP = `sweety-video-gen: 通用视频生成（/v1/media 协议）

用法:
  main.ts --prompt "视频描述" [--ref 1.jpg 2.png] [--duration 10] [--ar 16:9] [--output out.mp4]
  main.ts --status <task_id>            查询任务状态
  main.ts --wait <task_id>              等待任务完成并下载
  main.ts --retry <task_id>             重试失败任务
  main.ts --models                      查询可用模型
  main.ts --usage                       查看历史任务成本统计

选项:
  --prompt, -p <text>       生成提示词（必填）
  --ref <files...>          参考图，本地文件自动上传，也接受已上传的 URL
  --model, -m <id>          模型 ID（默认 video-v1）
  --duration, -d <sec>      视频时长，仅 5/10/15 有对应价目（默认 10），其它时长可能按兜底价计费
  --ar <ratio>              宽高比（默认 16:9）
  --output, -o <path>       输出文件路径（默认 video-<task_id>.mp4）
  --no-wait                 创建后立即返回 task_id，不等待
  --no-download             完成后只打印结果 URL，不下载
  --poll-interval <sec>     轮询间隔（默认 15）
  --timeout-minutes <min>   等待超时（默认 30）
  --base-url <url>          覆盖服务地址
  --api-key <key>           覆盖 API Key
  --json                    JSON 输出
  --help, -h                显示帮助

配置（推荐写入 ~/.sweety-skills/.env）:
  ${ENV_BASE_URL}=https://your-host/
  ${ENV_API_KEY}=your-api-key`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  await loadEnv();
  const extend = await loadExtend();
  const config = resolveConfig(args, extend, process.env);
  if (args.usage) {
    await showUsage(config, args.json);
    return;
  }
  if (!config.baseUrl) {
    throw new Error(`缺少服务地址。在 ~/.sweety-skills/.env 写入 ${ENV_BASE_URL}=https://your-host/，或用 --base-url 传入`);
  }
  if (args.models) {
    await listModels(config, args.json);
    return;
  }
  if (!config.apiKey) {
    throw new Error(`缺少 API Key。在 ~/.sweety-skills/.env 写入 ${ENV_API_KEY}=your-api-key，或用 --api-key 传入`);
  }
  if (args.statusId != null && !Number.isNaN(args.statusId)) {
    const status = await queryStatus(config, args.statusId);
    const downloadUrl = status.state === "success" ? joinUrl(config.baseUrl, pickDownloadUrl(status)) : "";
    printResult(config, args, status, null, downloadUrl);
    return;
  }
  const unknownMeta: TaskMeta = { model: null, duration: null, aspectRatio: null, prompt: null };
  if (args.waitId != null && !Number.isNaN(args.waitId)) {
    await finishTask(config, args, args.waitId, unknownMeta);
    return;
  }
  if (args.retryId != null && !Number.isNaN(args.retryId)) {
    await retryTask(config, args.retryId);
    process.stderr.write(`任务 ${args.retryId} 已重新排队\n`);
    if (args.noWait) return;
    await finishTask(config, args, args.retryId, unknownMeta);
    return;
  }
  if (!args.prompt) {
    throw new Error("缺少 --prompt。用 --help 查看用法");
  }
  const isVideo = !config.model.startsWith("image");
  if (isVideo && ![5, 10, 15].includes(config.duration)) {
    process.stderr.write(`警告: 时长 ${config.duration}s 不在价目表(5/10/15)内，可能按兜底价计费\n`);
  }
  const images = await resolveRefs(config, args.refs);
  process.stderr.write(`使用模型 ${config.model}，时长 ${config.duration}s，比例 ${config.aspectRatio}\n`);
  const taskId = await createTask(config, args.prompt, images);
  process.stderr.write(`任务已创建: task_id=${taskId}\n`);
  if (args.noWait) {
    if (args.json) console.log(JSON.stringify({ task_id: taskId, state: "pending" }, null, 2));
    else console.log(`task_id: ${taskId}`);
    return;
  }
  await finishTask(config, args, taskId, {
    model: config.model,
    duration: isVideo ? config.duration : null,
    aspectRatio: config.aspectRatio,
    prompt: args.prompt,
  });
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`错误: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
