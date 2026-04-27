import path from "node:path";
import process from "node:process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  BatchFile,
  BatchTaskInput,
  CliArgs,
  ExtendConfig,
  Provider,
} from "./types";

type ProviderModule = {
  getDefaultModel: () => string;
  generateImage: (prompt: string, model: string, args: CliArgs) => Promise<Uint8Array>;
  validateArgs?: (model: string, args: CliArgs) => void;
  getDefaultOutputExtension?: (model: string, args: CliArgs) => string;
};

type PreparedTask = {
  id: string;
  prompt: string;
  args: CliArgs;
  providers: Provider[];
  extendConfig: Partial<ExtendConfig>;
  outputPath: string;
};

type TaskResult = {
  id: string;
  provider: Provider;
  model: string;
  outputPath: string;
  success: boolean;
  attempts: number;
  error: string | null;
  width?: number;
  height?: number;
  format?: string;
  standardized?: boolean;
  postprocess?: string;
};

type ProviderRateLimit = {
  concurrency: number;
  startIntervalMs: number;
};

type LoadedBatchTasks = {
  tasks: BatchTaskInput[];
  jobs: number | null;
  batchDir: string;
};

type ImageMetadata = {
  format: "jpeg" | "png" | "webp" | "unknown";
  width: number | null;
  height: number | null;
};

type StandardizedImage = {
  data: Uint8Array;
  metadata: ImageMetadata;
  standardized: boolean;
  postprocess: string | null;
};

type SharpModule = (input: Uint8Array | Buffer) => {
  metadata: () => Promise<{ width?: number; height?: number; format?: string }>;
  resize: (options: {
    width: number;
    height: number;
    fit: "cover" | "contain";
    position?: string;
    background?: string;
  }) => unknown;
  png: () => { toBuffer: () => Promise<Buffer> };
  jpeg: (options?: { quality?: number; mozjpeg?: boolean }) => { toBuffer: () => Promise<Buffer> };
  webp: (options?: { quality?: number }) => { toBuffer: () => Promise<Buffer> };
  toBuffer: () => Promise<Buffer>;
};

const MAX_ATTEMPTS = 3;
const DEFAULT_MAX_WORKERS = 10;
const POLL_WAIT_MS = 250;
const DEFAULT_PROVIDER_FALLBACK_ORDER: Provider[] = [
  "google",
  "relay",
  "dashscope",
  "openai",
  "openrouter",
  "replicate",
  "jimeng",
  "seedream",
];
const DEFAULT_PROVIDER_RATE_LIMITS: Record<Provider, ProviderRateLimit> = {
  replicate: { concurrency: 5, startIntervalMs: 700 },
  google: { concurrency: 3, startIntervalMs: 1100 },
  relay: { concurrency: 3, startIntervalMs: 1100 },
  openai: { concurrency: 3, startIntervalMs: 1100 },
  openrouter: { concurrency: 3, startIntervalMs: 1100 },
  dashscope: { concurrency: 3, startIntervalMs: 1100 },
  jimeng: { concurrency: 3, startIntervalMs: 1100 },
  seedream: { concurrency: 3, startIntervalMs: 1100 },
};

function printUsage(): void {
  console.log(`Usage:
  npx -y bun scripts/main.ts --prompt "A cat" --image cat.png
  npx -y bun scripts/main.ts --promptfiles system.md content.md --image out.png
  npx -y bun scripts/main.ts --batchfile batch.json

Options:
  -p, --prompt <text>       Prompt text
  --promptfiles <files...>  Read prompt from files (concatenated)
  --image <path>            Output image path (required in single-image mode)
  --batchfile <path>        JSON batch file for multi-image generation
  --jobs <count>            Worker count for batch mode (default: auto, max from config, built-in default 10)
  --provider google|relay|openai|openrouter|dashscope|replicate|jimeng|seedream  Force provider (auto-detect by default)
  -m, --model <id>          Model ID
  --ar <ratio>              Aspect ratio (e.g., 16:9, 1:1, 4:3)
  --size <WxH>              Size (e.g., 1024x1024)
  --quality normal|2k       Quality preset (default: 2k)
  --imageSize 1K|2K|4K      Image size for Google/OpenRouter (default: from quality)
  --ref <files...>          Reference images (Google, OpenAI, OpenRouter, Replicate, or Seedream 4.0/4.5/5.0)
  --n <count>               Number of images for the current task (default: 1)
  --json                    JSON output
  -h, --help                Show help

Batch file format:
  {
    "jobs": 4,
    "tasks": [
      {
        "id": "hero",
        "promptFiles": ["prompts/hero.md"],
        "image": "out/hero.png",
        "provider": "replicate",
        "model": "google/nano-banana-pro",
        "ar": "16:9"
      }
    ]
  }

Behavior:
  - Batch mode automatically runs in parallel when pending tasks >= 2
  - Each image retries automatically up to 3 attempts
  - Batch summary reports success count, failure count, and per-image errors

Environment variables:
  RELAY_API_KEY              Relay API key (OpenAI-compatible relay)
  RELAY_BASE_URL             Relay endpoint (OpenAI-compatible, e.g. https://new.suxi.ai/v1)
  RELAY_IMAGE_MODEL          Default relay model (gemini-2.5-flash-image)
  OPENAI_API_KEY            OpenAI API key
  OPENROUTER_API_KEY        OpenRouter API key
  GOOGLE_API_KEY            Google API key
  GEMINI_API_KEY            Gemini API key (alias for GOOGLE_API_KEY)
  DASHSCOPE_API_KEY         DashScope API key
  REPLICATE_API_TOKEN       Replicate API token
  JIMENG_ACCESS_KEY_ID      Jimeng Access Key ID
  JIMENG_SECRET_ACCESS_KEY  Jimeng Secret Access Key
  ARK_API_KEY               Seedream/Ark API key
  OPENAI_IMAGE_MODEL        Default OpenAI model (gpt-image-1.5)
  OPENROUTER_IMAGE_MODEL    Default OpenRouter model (google/gemini-3.1-flash-image-preview)
  GOOGLE_IMAGE_MODEL        Default Google model (gemini-3-pro-image-preview)
  DASHSCOPE_IMAGE_MODEL     Default DashScope model (qwen-image-2.0-pro)
  REPLICATE_IMAGE_MODEL     Default Replicate model (google/nano-banana-pro)
  JIMENG_IMAGE_MODEL        Default Jimeng model (jimeng_t2i_v40)
  SEEDREAM_IMAGE_MODEL      Default Seedream model (doubao-seedream-5-0-260128)
  OPENAI_BASE_URL           Custom OpenAI endpoint
  OPENAI_IMAGE_USE_CHAT     Use /chat/completions instead of /images/generations (true|false)
  OPENROUTER_BASE_URL       Custom OpenRouter endpoint
  OPENROUTER_HTTP_REFERER   Optional app URL for OpenRouter attribution
  OPENROUTER_TITLE          Optional app name for OpenRouter attribution
  GOOGLE_BASE_URL           Custom Google endpoint
  DASHSCOPE_BASE_URL        Custom DashScope endpoint
  REPLICATE_BASE_URL        Custom Replicate endpoint
  JIMENG_BASE_URL           Custom Jimeng endpoint
  SEEDREAM_BASE_URL         Custom Seedream endpoint
  SWEETY_IMAGE_GEN_MAX_WORKERS  Override batch worker cap
  SWEETY_IMAGE_GEN_<PROVIDER>_CONCURRENCY  Override provider concurrency
  SWEETY_IMAGE_GEN_<PROVIDER>_START_INTERVAL_MS  Override provider start gap in ms

Env file load order: CLI args > EXTEND.md > process.env > <cwd>/.sweety-skills/.env > ~/.sweety-skills/.env`);
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    prompt: null,
    promptFiles: [],
    imagePath: null,
    provider: null,
    model: null,
    aspectRatio: null,
    size: null,
    quality: null,
    imageSize: null,
    referenceImages: [],
    n: 1,
    batchFile: null,
    jobs: null,
    json: false,
    help: false,
  };

  const positional: string[] = [];

  const takeMany = (i: number): { items: string[]; next: number } => {
    const items: string[] = [];
    let j = i + 1;
    while (j < argv.length) {
      const v = argv[j]!;
      if (v.startsWith("-")) break;
      items.push(v);
      j++;
    }
    return { items, next: j - 1 };
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }

    if (a === "--json") {
      out.json = true;
      continue;
    }

    if (a === "--prompt" || a === "-p") {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${a}`);
      out.prompt = v;
      continue;
    }

    if (a === "--promptfiles") {
      const { items, next } = takeMany(i);
      if (items.length === 0) throw new Error("Missing files for --promptfiles");
      out.promptFiles.push(...items);
      i = next;
      continue;
    }

    if (a === "--image") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --image");
      out.imagePath = v;
      continue;
    }

    if (a === "--batchfile") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --batchfile");
      out.batchFile = v;
      continue;
    }

    if (a === "--jobs") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --jobs");
      out.jobs = parseInt(v, 10);
      if (isNaN(out.jobs) || out.jobs < 1) throw new Error(`Invalid worker count: ${v}`);
      continue;
    }

    if (a === "--provider") {
      const v = argv[++i];
      if (
        v !== "google" &&
        v !== "relay" &&
        v !== "openai" &&
        v !== "openrouter" &&
        v !== "dashscope" &&
        v !== "replicate" &&
        v !== "jimeng" &&
        v !== "seedream"
      ) {
        throw new Error(`Invalid provider: ${v}`);
      }
      out.provider = v;
      continue;
    }

    if (a === "--model" || a === "-m") {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${a}`);
      out.model = v;
      continue;
    }

    if (a === "--ar") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --ar");
      out.aspectRatio = v;
      continue;
    }

    if (a === "--size") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --size");
      out.size = v;
      continue;
    }

    if (a === "--quality") {
      const v = argv[++i];
      if (v !== "normal" && v !== "2k") throw new Error(`Invalid quality: ${v}`);
      out.quality = v;
      continue;
    }

    if (a === "--imageSize") {
      const v = argv[++i]?.toUpperCase();
      if (v !== "1K" && v !== "2K" && v !== "4K") throw new Error(`Invalid imageSize: ${v}`);
      out.imageSize = v;
      continue;
    }

    if (a === "--ref" || a === "--reference") {
      const { items, next } = takeMany(i);
      if (items.length === 0) throw new Error(`Missing files for ${a}`);
      out.referenceImages.push(...items);
      i = next;
      continue;
    }

    if (a === "--n") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --n");
      out.n = parseInt(v, 10);
      if (isNaN(out.n) || out.n < 1) throw new Error(`Invalid count: ${v}`);
      continue;
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }

    positional.push(a);
  }

  if (!out.prompt && out.promptFiles.length === 0 && positional.length > 0) {
    out.prompt = positional.join(" ");
  }

  return out;
}

async function loadEnvFile(p: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(p, "utf8");
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

export function extractYamlFrontMatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*$/m);
  return match ? match[1] : null;
}

export function parseSimpleYaml(yaml: string): Partial<ExtendConfig> {
  const config: Partial<ExtendConfig> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  let currentProvider: Provider | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentKey === "provider_fallback_order") {
      const rawValue = trimmed.slice(2).trim().replace(/['"]/g, "");
      if (
        rawValue === "google" ||
        rawValue === "relay" ||
        rawValue === "openai" ||
        rawValue === "openrouter" ||
        rawValue === "dashscope" ||
        rawValue === "replicate" ||
        rawValue === "jimeng" ||
        rawValue === "seedream"
      ) {
        config.provider_fallback_order ??= [];
        config.provider_fallback_order.push(rawValue);
      }
      continue;
    }

    if (trimmed.includes(":") && !trimmed.startsWith("-")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      if (value === "null" || value === "") {
        value = "null";
      }

      if (key === "version") {
        config.version = value === "null" ? 1 : parseInt(value, 10);
      } else if (key === "default_provider") {
        config.default_provider = value === "null" ? null : (value as Provider);
      } else if (key === "provider_fallback_order") {
        config.provider_fallback_order = [];
        currentKey = "provider_fallback_order";
        currentProvider = null;
      } else if (key === "default_quality") {
        config.default_quality = value === "null" ? null : value as "normal" | "2k";
      } else if (key === "default_aspect_ratio") {
        const cleaned = value.replace(/['"]/g, "");
        config.default_aspect_ratio = cleaned === "null" ? null : cleaned;
      } else if (key === "default_image_size") {
        config.default_image_size = value === "null" ? null : value as "1K" | "2K" | "4K";
      } else if (key === "default_model") {
        config.default_model = {
          google: null,
          relay: null,
          openai: null,
          openrouter: null,
          dashscope: null,
          replicate: null,
          jimeng: null,
          seedream: null,
        };
        currentKey = "default_model";
        currentProvider = null;
      } else if (key === "batch") {
        config.batch = {};
        currentKey = "batch";
        currentProvider = null;
      } else if (currentKey === "batch" && indent >= 2 && key === "max_workers") {
        config.batch ??= {};
        config.batch.max_workers = value === "null" ? null : parseInt(value, 10);
      } else if (currentKey === "batch" && indent >= 2 && key === "provider_limits") {
        config.batch ??= {};
        config.batch.provider_limits ??= {};
        currentKey = "provider_limits";
        currentProvider = null;
      } else if (
        currentKey === "provider_limits" &&
        indent >= 4 &&
        (
          key === "google" ||
          key === "relay" ||
          key === "openai" ||
          key === "openrouter" ||
          key === "dashscope" ||
          key === "replicate" ||
          key === "jimeng" ||
          key === "seedream"
        )
      ) {
        config.batch ??= {};
        config.batch.provider_limits ??= {};
        config.batch.provider_limits[key] ??= {};
        currentProvider = key;
      } else if (
        currentKey === "default_model" &&
        (
          key === "google" ||
          key === "relay" ||
          key === "openai" ||
          key === "openrouter" ||
          key === "dashscope" ||
          key === "replicate" ||
          key === "jimeng" ||
          key === "seedream"
        )
      ) {
        const cleaned = value.replace(/['"]/g, "");
        config.default_model![key] = cleaned === "null" ? null : cleaned;
      } else if (
        currentKey === "provider_limits" &&
        currentProvider &&
        indent >= 6 &&
        (key === "concurrency" || key === "start_interval_ms")
      ) {
        config.batch ??= {};
        config.batch.provider_limits ??= {};
        const providerLimit = (config.batch.provider_limits[currentProvider] ??= {});
        if (key === "concurrency") {
          providerLimit.concurrency = value === "null" ? null : parseInt(value, 10);
        } else {
          providerLimit.start_interval_ms = value === "null" ? null : parseInt(value, 10);
        }
      }
    }
  }

  return config;
}

async function loadExtendConfig(): Promise<Partial<ExtendConfig>> {
  const home = homedir();
  const cwd = process.cwd();

  const paths = [
    path.join(cwd, ".sweety-skills", "sweety-image-gen", "EXTEND.md"),
    path.join(home, ".sweety-skills", "sweety-image-gen", "EXTEND.md"),
  ];

  for (const p of paths) {
    try {
      const content = await readFile(p, "utf8");
      const yaml = extractYamlFrontMatter(content);
      if (!yaml) continue;
      return parseSimpleYaml(yaml);
    } catch {
      continue;
    }
  }

  return {};
}

export function mergeConfig(args: CliArgs, extend: Partial<ExtendConfig>): CliArgs {
  return {
    ...args,
    // Keep provider null in auto mode so detectProviderChain can apply
    // default_provider as an ordering preference instead of forcing a single provider.
    provider: args.provider ?? null,
    quality: args.quality ?? extend.default_quality ?? null,
    aspectRatio: args.aspectRatio ?? extend.default_aspect_ratio ?? null,
    imageSize: args.imageSize ?? extend.default_image_size ?? null,
  };
}

export function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parsePositiveBatchInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    return parsePositiveInt(value);
  }
  return null;
}

export function getConfiguredMaxWorkers(extendConfig: Partial<ExtendConfig>): number {
  const envValue = parsePositiveInt(process.env.SWEETY_IMAGE_GEN_MAX_WORKERS);
  const configValue = extendConfig.batch?.max_workers ?? null;
  return Math.max(1, envValue ?? configValue ?? DEFAULT_MAX_WORKERS);
}

export function getConfiguredProviderRateLimits(
  extendConfig: Partial<ExtendConfig>
): Record<Provider, ProviderRateLimit> {
  const configured: Record<Provider, ProviderRateLimit> = {
    replicate: { ...DEFAULT_PROVIDER_RATE_LIMITS.replicate },
    google: { ...DEFAULT_PROVIDER_RATE_LIMITS.google },
    relay: { ...DEFAULT_PROVIDER_RATE_LIMITS.relay },
    openai: { ...DEFAULT_PROVIDER_RATE_LIMITS.openai },
    openrouter: { ...DEFAULT_PROVIDER_RATE_LIMITS.openrouter },
    dashscope: { ...DEFAULT_PROVIDER_RATE_LIMITS.dashscope },
    jimeng: { ...DEFAULT_PROVIDER_RATE_LIMITS.jimeng },
    seedream: { ...DEFAULT_PROVIDER_RATE_LIMITS.seedream },
  };

  for (const provider of ["replicate", "google", "relay", "openai", "openrouter", "dashscope", "jimeng", "seedream"] as Provider[]) {
    const envPrefix = `SWEETY_IMAGE_GEN_${provider.toUpperCase()}`;
    const extendLimit = extendConfig.batch?.provider_limits?.[provider];
    configured[provider] = {
      concurrency:
        parsePositiveInt(process.env[`${envPrefix}_CONCURRENCY`]) ??
        extendLimit?.concurrency ??
        configured[provider].concurrency,
      startIntervalMs:
        parsePositiveInt(process.env[`${envPrefix}_START_INTERVAL_MS`]) ??
        extendLimit?.start_interval_ms ??
        configured[provider].startIntervalMs,
    };
  }

  return configured;
}

async function readPromptFromFiles(files: string[]): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    parts.push(await readFile(f, "utf8"));
  }
  return parts.join("\n\n");
}

async function readPromptFromStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const value = Buffer.concat(chunks).toString("utf8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function normalizeOutputImagePath(p: string, defaultExtension = ".png"): string {
  const full = path.resolve(p);
  const ext = path.extname(full);
  if (ext) return full;
  return `${full}${defaultExtension}`;
}

function inferProviderFromModel(model: string | null): Provider | null {
  if (!model) return null;
  if (model.includes("seedream") || model.includes("seededit")) return "seedream";
  return null;
}

function isProviderConfigured(provider: Provider): boolean {
  if (provider === "google") return !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  if (provider === "relay") return !!process.env.RELAY_API_KEY;
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider === "openrouter") return !!process.env.OPENROUTER_API_KEY;
  if (provider === "dashscope") return !!process.env.DASHSCOPE_API_KEY;
  if (provider === "replicate") return !!process.env.REPLICATE_API_TOKEN;
  if (provider === "jimeng") return !!(process.env.JIMENG_ACCESS_KEY_ID && process.env.JIMENG_SECRET_ACCESS_KEY);
  return !!process.env.ARK_API_KEY;
}

function supportsReferenceImages(provider: Provider): boolean {
  return (
    provider === "google" ||
    provider === "relay" ||
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "replicate" ||
    provider === "seedream"
  );
}

export function getProviderFallbackOrder(extendConfig: Partial<ExtendConfig> = {}): Provider[] {
  const configured = (extendConfig.provider_fallback_order || []).filter((provider): provider is Provider => (
    provider === "google" ||
    provider === "relay" ||
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "dashscope" ||
    provider === "replicate" ||
    provider === "jimeng" ||
    provider === "seedream"
  ));
  const preferred = extendConfig.default_provider ? [extendConfig.default_provider] : [];
  return [...new Set([...preferred, ...configured, ...DEFAULT_PROVIDER_FALLBACK_ORDER])];
}

export function detectProviderChain(
  args: CliArgs,
  extendConfig: Partial<ExtendConfig> = {}
): Provider[] {
  if (
    args.referenceImages.length > 0 &&
    args.provider &&
    !supportsReferenceImages(args.provider)
  ) {
    throw new Error(
      "Reference images require a ref-capable provider. Use --provider google (Gemini multimodal), --provider relay (OpenAI-compatible relay), --provider openai (GPT Image edits), --provider openrouter (OpenRouter multimodal), --provider replicate, or --provider seedream for supported Seedream models."
    );
  }

  if (args.provider) return [args.provider];

  const modelProvider = inferProviderFromModel(args.model);

  if (modelProvider === "seedream") {
    if (!isProviderConfigured("seedream")) {
      throw new Error("Model looks like a Volcengine ARK image model, but ARK_API_KEY is not set.");
    }
    return ["seedream"];
  }

  const available = getProviderFallbackOrder(extendConfig)
    .filter((provider) => isProviderConfigured(provider))
    .filter((provider) => (args.referenceImages.length > 0 ? supportsReferenceImages(provider) : true));

  if (available.length > 0) return available;

  if (args.referenceImages.length > 0) {
    throw new Error(
      "Reference images require Google, Relay, OpenAI, OpenRouter, Replicate, or supported Seedream models. Set GOOGLE_API_KEY/GEMINI_API_KEY, RELAY_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, REPLICATE_API_TOKEN, or ARK_API_KEY, or remove --ref."
    );
  }

  throw new Error(
    "No API key found. Set GOOGLE_API_KEY, GEMINI_API_KEY, RELAY_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, DASHSCOPE_API_KEY, REPLICATE_API_TOKEN, JIMENG keys, or ARK_API_KEY.\n" +
      "Create ~/.sweety-skills/.env or <cwd>/.sweety-skills/.env with your keys."
  );
}

export function detectProvider(
  args: CliArgs,
  extendConfig: Partial<ExtendConfig> = {}
): Provider {
  return detectProviderChain(args, extendConfig)[0]!;
}

export async function validateReferenceImages(referenceImages: string[]): Promise<void> {
  for (const refPath of referenceImages) {
    const fullPath = path.resolve(refPath);
    try {
      await access(fullPath);
    } catch {
      throw new Error(`Reference image not found: ${fullPath}`);
    }
  }
}

export function isRetryableGenerationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const nonRetryableMarkers = [
    "Reference image",
    "not supported",
    "only supported",
    "No API key found",
    "is required",
    "Invalid ",
    "Unexpected ",
    "API error (400)",
    "API error (401)",
    "API error (402)",
    "API error (403)",
    "API error (404)",
    "temporarily disabled",
  ];
  return !nonRetryableMarkers.some((marker) => msg.includes(marker));
}

async function loadProviderModule(provider: Provider): Promise<ProviderModule> {
  if (provider === "google") return (await import("./providers/google")) as ProviderModule;
  if (provider === "relay") return (await import("./providers/relay")) as ProviderModule;
  if (provider === "dashscope") return (await import("./providers/dashscope")) as ProviderModule;
  if (provider === "replicate") return (await import("./providers/replicate")) as ProviderModule;
  if (provider === "openrouter") return (await import("./providers/openrouter")) as ProviderModule;
  if (provider === "jimeng") return (await import("./providers/jimeng")) as ProviderModule;
  if (provider === "seedream") return (await import("./providers/seedream")) as ProviderModule;
  return (await import("./providers/openai")) as ProviderModule;
}

async function loadPromptForArgs(args: CliArgs): Promise<string | null> {
  let prompt: string | null = args.prompt;
  if (!prompt && args.promptFiles.length > 0) {
    prompt = await readPromptFromFiles(args.promptFiles);
  }
  return prompt;
}

function getModelForProvider(
  provider: Provider,
  requestedModel: string | null,
  extendConfig: Partial<ExtendConfig>,
  providerModule: ProviderModule
): string {
  if (requestedModel) return requestedModel;
  if (extendConfig.default_model) {
    if (provider === "google" && extendConfig.default_model.google) return extendConfig.default_model.google;
    if (provider === "relay" && extendConfig.default_model.relay) return extendConfig.default_model.relay;
    if (provider === "openai" && extendConfig.default_model.openai) return extendConfig.default_model.openai;
    if (provider === "openrouter" && extendConfig.default_model.openrouter) {
      return extendConfig.default_model.openrouter;
    }
    if (provider === "dashscope" && extendConfig.default_model.dashscope) return extendConfig.default_model.dashscope;
    if (provider === "replicate" && extendConfig.default_model.replicate) return extendConfig.default_model.replicate;
    if (provider === "jimeng" && extendConfig.default_model.jimeng) return extendConfig.default_model.jimeng;
    if (provider === "seedream" && extendConfig.default_model.seedream) return extendConfig.default_model.seedream;
  }
  return providerModule.getDefaultModel();
}

export function parseAspectRatioValue(ar: string | null): number | null {
  if (!ar) return null;
  const match = ar.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
}

export function parseRequestedSize(size: string | null): { width: number; height: number } | null {
  if (!size) return null;
  const match = size.match(/^(\d+)[x*](\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function getTargetDimensions(args: CliArgs, metadata: ImageMetadata): { width: number; height: number } | null {
  const requestedSize = parseRequestedSize(args.size);
  if (requestedSize) return requestedSize;

  const ratio = parseAspectRatioValue(args.aspectRatio);
  if (!ratio) return null;

  const targetEdge = args.quality === "normal" ? 1024 : 2048;
  if (ratio >= 1) {
    return {
      width: targetEdge,
      height: even(targetEdge / ratio),
    };
  }

  return {
    width: even(targetEdge * ratio),
    height: targetEdge,
  };
}

export function outputFormatFromPath(outputPath: string): "jpeg" | "png" | "webp" {
  const ext = path.extname(outputPath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".webp") return "webp";
  return "png";
}

function imageFormatFromBytes(data: Uint8Array): ImageMetadata["format"] {
  if (data[0] === 0xff && data[1] === 0xd8) return "jpeg";
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "png";
  }
  if (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) * 0x1000000) +
    ((data[offset + 1] ?? 0) << 16) +
    ((data[offset + 2] ?? 0) << 8) +
    (data[offset + 3] ?? 0)
  );
}

function parsePngDimensions(data: Uint8Array): Pick<ImageMetadata, "width" | "height"> {
  if (data.length < 24) return { width: null, height: null };
  return {
    width: readUint32BE(data, 16),
    height: readUint32BE(data, 20),
  };
}

function parseJpegDimensions(data: Uint8Array): Pick<ImageMetadata, "width" | "height"> {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = ((data[offset + 2] ?? 0) << 8) + (data[offset + 3] ?? 0);
    if (length < 2) break;

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: ((data[offset + 5] ?? 0) << 8) + (data[offset + 6] ?? 0),
        width: ((data[offset + 7] ?? 0) << 8) + (data[offset + 8] ?? 0),
      };
    }

    offset += 2 + length;
  }

  return { width: null, height: null };
}

export function inspectImageData(data: Uint8Array): ImageMetadata {
  const format = imageFormatFromBytes(data);
  if (format === "png") return { format, ...parsePngDimensions(data) };
  if (format === "jpeg") return { format, ...parseJpegDimensions(data) };
  return { format, width: null, height: null };
}

export function hasAspectMismatch(metadata: ImageMetadata, args: CliArgs): boolean {
  const requestedRatio = parseAspectRatioValue(args.aspectRatio);
  if (!requestedRatio || !metadata.width || !metadata.height) return false;
  const actualRatio = metadata.width / metadata.height;
  return Math.abs(actualRatio - requestedRatio) / requestedRatio > 0.03;
}

function getSharpSearchPaths(): string[] {
  const skillDir = path.dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  const paths = [
    process.env.SWEETY_IMAGE_GEN_SHARP_MODULE,
    path.join(skillDir, "..", "node_modules", "sharp"),
    path.join(skillDir, "..", "..", "node_modules", "sharp"),
    path.join(cwd, "node_modules", "sharp"),
    path.join(
      homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
      "sharp",
    ),
  ];
  return paths.filter((item): item is string => Boolean(item));
}

function loadSharp(): SharpModule | null {
  const require = createRequire(import.meta.url);
  try {
    return require("sharp") as SharpModule;
  } catch {
    // Fall through to known optional runtime locations.
  }

  for (const candidate of getSharpSearchPaths()) {
    if (!existsSync(candidate)) continue;
    try {
      return require(candidate) as SharpModule;
    } catch {
      continue;
    }
  }

  return null;
}

async function readMetadataWithSharp(data: Uint8Array, fallback: ImageMetadata): Promise<ImageMetadata> {
  if (fallback.width && fallback.height && fallback.format !== "unknown") return fallback;
  const sharp = loadSharp();
  if (!sharp) return fallback;
  try {
    const metadata = await sharp(data).metadata();
    return {
      format:
        metadata.format === "jpeg" ||
        metadata.format === "png" ||
        metadata.format === "webp"
          ? metadata.format
          : fallback.format,
      width: metadata.width ?? fallback.width,
      height: metadata.height ?? fallback.height,
    };
  } catch {
    return fallback;
  }
}

export async function standardizeImageData(
  imageData: Uint8Array,
  outputPath: string,
  args: CliArgs,
): Promise<StandardizedImage> {
  const inspected = await readMetadataWithSharp(imageData, inspectImageData(imageData));
  const requestedFormat = outputFormatFromPath(outputPath);
  const targetDimensions = getTargetDimensions(args, inspected);
  const needsResize =
    !!targetDimensions &&
    (inspected.width !== targetDimensions.width || inspected.height !== targetDimensions.height);
  const needsFormatConversion =
    inspected.format !== "unknown" && inspected.format !== requestedFormat;

  if (!needsResize && !needsFormatConversion) {
    return {
      data: imageData,
      metadata: inspected,
      standardized: false,
      postprocess: null,
    };
  }

  const sharp = loadSharp();
  if (!sharp) {
    const reason = needsResize
      ? `output was ${inspected.width ?? "unknown"}x${inspected.height ?? "unknown"}`
      : `output format was ${inspected.format}`;
    throw new Error(
      `Image output needs standardization (${reason}), but sharp is unavailable. ` +
      `Install sharp or set SWEETY_IMAGE_GEN_SHARP_MODULE to its module path.`
    );
  }

  let pipeline = sharp(imageData);
  if (targetDimensions) {
    pipeline = pipeline.resize({
      width: targetDimensions.width,
      height: targetDimensions.height,
      fit: "cover",
      position: "centre",
      background: "#ffffff",
    }) as ReturnType<SharpModule>;
  }

  let output: Buffer;
  if (requestedFormat === "jpeg") {
    output = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  } else if (requestedFormat === "webp") {
    output = await pipeline.webp({ quality: 92 }).toBuffer();
  } else {
    output = await pipeline.png().toBuffer();
  }

  const metadata = await readMetadataWithSharp(output, inspectImageData(output));
  const notes: string[] = [];
  if (needsResize && targetDimensions) {
    notes.push(
      `resized from ${inspected.width ?? "unknown"}x${inspected.height ?? "unknown"} to ` +
      `${targetDimensions.width}x${targetDimensions.height}`
    );
  }
  if (needsFormatConversion) {
    notes.push(`converted ${inspected.format} to ${requestedFormat}`);
  }

  return {
    data: output,
    metadata,
    standardized: true,
    postprocess: notes.join("; "),
  };
}

async function prepareSingleTask(args: CliArgs, extendConfig: Partial<ExtendConfig>): Promise<PreparedTask> {
  if (!args.quality) args.quality = "2k";

  const prompt = (await loadPromptForArgs(args)) ?? (await readPromptFromStdin());
  if (!prompt) throw new Error("Prompt is required");
  if (!args.imagePath) throw new Error("--image is required");
  if (args.referenceImages.length > 0) await validateReferenceImages(args.referenceImages);

  const providers = detectProviderChain(args, extendConfig);
  const firstProvider = providers[0]!;
  const providerModule = await loadProviderModule(firstProvider);
  const model = getModelForProvider(firstProvider, args.model, extendConfig, providerModule);
  providerModule.validateArgs?.(model, args);
  const defaultOutputExtension = providerModule.getDefaultOutputExtension?.(model, args) ?? ".png";

  return {
    id: "single",
    prompt,
    args,
    providers,
    extendConfig,
    outputPath: normalizeOutputImagePath(args.imagePath, defaultOutputExtension),
  };
}

export async function loadBatchTasks(batchFilePath: string): Promise<LoadedBatchTasks> {
  const resolvedBatchFilePath = path.resolve(batchFilePath);
  const content = await readFile(resolvedBatchFilePath, "utf8");
  const parsed = JSON.parse(content.replace(/^\uFEFF/, "")) as BatchFile;
  const batchDir = path.dirname(resolvedBatchFilePath);
  if (Array.isArray(parsed)) {
    return {
      tasks: parsed,
      jobs: null,
      batchDir,
    };
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
    const jobs = parsePositiveBatchInt(parsed.jobs);
    if (parsed.jobs !== undefined && parsed.jobs !== null && jobs === null) {
      throw new Error("Invalid batch file. jobs must be a positive integer when provided.");
    }
    return {
      tasks: parsed.tasks,
      jobs,
      batchDir,
    };
  }
  throw new Error("Invalid batch file. Expected an array of tasks or an object with a tasks array.");
}

export function resolveBatchPath(batchDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(batchDir, filePath);
}

export function createTaskArgs(baseArgs: CliArgs, task: BatchTaskInput, batchDir: string): CliArgs {
  return {
    ...baseArgs,
    prompt: task.prompt ?? null,
    promptFiles: task.promptFiles ? task.promptFiles.map((filePath) => resolveBatchPath(batchDir, filePath)) : [],
    imagePath: task.image ? resolveBatchPath(batchDir, task.image) : null,
    provider: task.provider ?? baseArgs.provider ?? null,
    model: task.model ?? baseArgs.model ?? null,
    aspectRatio: task.ar ?? baseArgs.aspectRatio ?? null,
    size: task.size ?? baseArgs.size ?? null,
    quality: task.quality ?? baseArgs.quality ?? null,
    imageSize: task.imageSize ?? baseArgs.imageSize ?? null,
    referenceImages: task.ref ? task.ref.map((filePath) => resolveBatchPath(batchDir, filePath)) : [],
    n: task.n ?? baseArgs.n,
    batchFile: null,
    jobs: baseArgs.jobs,
    json: baseArgs.json,
    help: false,
  };
}

async function prepareBatchTasks(
  args: CliArgs,
  extendConfig: Partial<ExtendConfig>
): Promise<{ tasks: PreparedTask[]; jobs: number | null }> {
  if (!args.batchFile) throw new Error("--batchfile is required in batch mode");
  const { tasks: taskInputs, jobs: batchJobs, batchDir } = await loadBatchTasks(args.batchFile);
  if (taskInputs.length === 0) throw new Error("Batch file does not contain any tasks.");

  const prepared: PreparedTask[] = [];
  for (let i = 0; i < taskInputs.length; i++) {
    const task = taskInputs[i]!;
    const taskArgs = createTaskArgs(args, task, batchDir);
    const prompt = await loadPromptForArgs(taskArgs);
    if (!prompt) throw new Error(`Task ${i + 1} is missing prompt or promptFiles.`);
    if (!taskArgs.imagePath) throw new Error(`Task ${i + 1} is missing image output path.`);
    if (taskArgs.referenceImages.length > 0) await validateReferenceImages(taskArgs.referenceImages);

    const providers = detectProviderChain(taskArgs, extendConfig);
    const firstProvider = providers[0]!;
    const providerModule = await loadProviderModule(firstProvider);
    const model = getModelForProvider(firstProvider, taskArgs.model, extendConfig, providerModule);
    providerModule.validateArgs?.(model, taskArgs);
    const defaultOutputExtension = providerModule.getDefaultOutputExtension?.(model, taskArgs) ?? ".png";
    prepared.push({
      id: task.id || `task-${String(i + 1).padStart(2, "0")}`,
      prompt,
      args: taskArgs,
      providers,
      extendConfig,
      outputPath: normalizeOutputImagePath(taskArgs.imagePath, defaultOutputExtension),
    });
  }

  return {
    tasks: prepared,
    jobs: args.jobs ?? batchJobs,
  };
}

async function writeImage(outputPath: string, imageData: Uint8Array): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, imageData);
}

async function generatePreparedTask(task: PreparedTask): Promise<TaskResult> {
  const fallbackEnabled = task.args.provider == null && task.providers.length > 1;
  let attempts = 0;
  const errors: string[] = [];

  if (fallbackEnabled) {
    console.error(`[${task.id}] Provider fallback order: ${task.providers.join(" -> ")}`);
  }

  for (let providerIndex = 0; providerIndex < task.providers.length; providerIndex += 1) {
    const provider = task.providers[providerIndex]!;
    const providerModule = await loadProviderModule(provider);
    const model = getModelForProvider(provider, task.args.model, task.extendConfig, providerModule);
    const maxAttempts = fallbackEnabled ? 1 : MAX_ATTEMPTS;

    console.error(`Using ${provider} / ${model} for ${task.id}`);
    console.error(
      `Switch model: --model <id> | EXTEND.md default_model.${provider} | env ${provider.toUpperCase()}_IMAGE_MODEL`
    );

    let lastError: string | null = null;
    for (let providerAttempt = 1; providerAttempt <= maxAttempts; providerAttempt += 1) {
      attempts += 1;
      try {
        providerModule.validateArgs?.(model, task.args);
        const imageData = await providerModule.generateImage(task.prompt, model, task.args);
        const inspected = await readMetadataWithSharp(imageData, inspectImageData(imageData));
        if (
          fallbackEnabled &&
          providerIndex < task.providers.length - 1 &&
          hasAspectMismatch(inspected, task.args)
        ) {
          throw new Error(
            `Image output aspect ratio mismatch: requested ${task.args.aspectRatio}, got ` +
            `${inspected.width ?? "unknown"}x${inspected.height ?? "unknown"} from ${provider}.`
          );
        }
        const standardized = await standardizeImageData(imageData, task.outputPath, task.args);
        await writeImage(task.outputPath, standardized.data);
        return {
          id: task.id,
          provider,
          model,
          outputPath: task.outputPath,
          success: true,
          attempts,
          error: null,
          width: standardized.metadata.width ?? undefined,
          height: standardized.metadata.height ?? undefined,
          format: standardized.metadata.format,
          standardized: standardized.standardized,
          postprocess: standardized.postprocess ?? undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const canRetryCurrentProvider =
          providerAttempt < maxAttempts && isRetryableGenerationError(error);
        if (canRetryCurrentProvider) {
          console.error(`[${task.id}] ${provider} attempt ${providerAttempt}/${maxAttempts} failed, retrying...`);
          continue;
        }
        break;
      }
    }

    if (lastError) {
      errors.push(`${provider}: ${lastError}`);
      if (fallbackEnabled) {
        console.error(`[${task.id}] ${provider} failed, trying next provider...`);
      } else {
        return {
          id: task.id,
          provider,
          model,
          outputPath: task.outputPath,
          success: false,
          attempts,
          error: lastError,
        };
      }
    }
  }

  const lastProvider = task.providers[task.providers.length - 1]!;
  const lastProviderModule = await loadProviderModule(lastProvider);
  const lastModel = getModelForProvider(lastProvider, task.args.model, task.extendConfig, lastProviderModule);
  return {
    id: task.id,
    provider: lastProvider,
    model: lastModel,
    outputPath: task.outputPath,
    success: false,
    attempts,
    error: errors.join("\n"),
  };
}

function createProviderGate(providerRateLimits: Record<Provider, ProviderRateLimit>) {
  const state = new Map<Provider, { active: number; lastStartedAt: number }>();

  return async function acquire(provider: Provider): Promise<() => void> {
    const limit = providerRateLimits[provider];
    while (true) {
      const current = state.get(provider) ?? { active: 0, lastStartedAt: 0 };
      const now = Date.now();
      const enoughCapacity = current.active < limit.concurrency;
      const enoughGap = now - current.lastStartedAt >= limit.startIntervalMs;
      if (enoughCapacity && enoughGap) {
        state.set(provider, { active: current.active + 1, lastStartedAt: now });
        return () => {
          const latest = state.get(provider) ?? { active: 1, lastStartedAt: now };
          state.set(provider, {
            active: Math.max(0, latest.active - 1),
            lastStartedAt: latest.lastStartedAt,
          });
        };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_WAIT_MS));
    }
  };
}

export function getWorkerCount(taskCount: number, jobs: number | null, maxWorkers: number): number {
  const requested = jobs ?? Math.min(taskCount, maxWorkers);
  return Math.max(1, Math.min(requested, taskCount, maxWorkers));
}

async function runBatchTasks(
  tasks: PreparedTask[],
  jobs: number | null,
  extendConfig: Partial<ExtendConfig>
): Promise<TaskResult[]> {
  if (tasks.length === 1) {
    return [await generatePreparedTask(tasks[0]!)];
  }

  const maxWorkers = getConfiguredMaxWorkers(extendConfig);
  const providerRateLimits = getConfiguredProviderRateLimits(extendConfig);
  const acquireProvider = createProviderGate(providerRateLimits);
  const workerCount = getWorkerCount(tasks.length, jobs, maxWorkers);
  console.error(`Batch mode: ${tasks.length} tasks, ${workerCount} workers, parallel mode enabled.`);
  for (const provider of ["replicate", "google", "relay", "openai", "openrouter", "dashscope", "jimeng", "seedream"] as Provider[]) {
    const limit = providerRateLimits[provider];
    console.error(`- ${provider}: concurrency=${limit.concurrency}, startIntervalMs=${limit.startIntervalMs}`);
  }

  let nextIndex = 0;
  const results: TaskResult[] = new Array(tasks.length);

  const worker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= tasks.length) return;

      const task = tasks[currentIndex]!;
      const release = await acquireProvider(task.providers[0]!);
      try {
        results[currentIndex] = await generatePreparedTask(task);
      } finally {
        release();
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function printBatchSummary(results: TaskResult[]): void {
  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;

  console.error("");
  console.error("Batch generation summary:");
  console.error(`- Total: ${results.length}`);
  console.error(`- Succeeded: ${successCount}`);
  console.error(`- Failed: ${failureCount}`);

  if (failureCount > 0) {
    console.error("Failure reasons:");
    for (const result of results.filter((item) => !item.success)) {
      console.error(`- ${result.id}: ${result.error}`);
    }
  }
}

function emitJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

async function runSingleMode(args: CliArgs, extendConfig: Partial<ExtendConfig>): Promise<void> {
  const task = await prepareSingleTask(args, extendConfig);
  const result = await generatePreparedTask(task);
  if (!result.success) {
    throw new Error(result.error || "Generation failed");
  }

  if (args.json) {
    emitJson({
      savedImage: result.outputPath,
      provider: result.provider,
      model: result.model,
      attempts: result.attempts,
      prompt: task.prompt.slice(0, 200),
    });
    return;
  }

  console.log(result.outputPath);
}

async function runBatchMode(args: CliArgs, extendConfig: Partial<ExtendConfig>): Promise<void> {
  const { tasks, jobs } = await prepareBatchTasks(args, extendConfig);
  const results = await runBatchTasks(tasks, jobs, extendConfig);
  printBatchSummary(results);

  if (args.json) {
    emitJson({
      mode: "batch",
      total: results.length,
      succeeded: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
      results,
    });
  }

  if (results.some((item) => !item.success)) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  await loadEnv();
  const extendConfig = await loadExtendConfig();
  const mergedArgs = mergeConfig(args, extendConfig);
  if (!mergedArgs.quality) mergedArgs.quality = "2k";

  if (mergedArgs.batchFile) {
    await runBatchMode(mergedArgs, extendConfig);
    return;
  }

  await runSingleMode(mergedArgs, extendConfig);
}

function isDirectExecution(metaUrl: string): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) return false;

  try {
    return path.resolve(entryPath) === fileURLToPath(metaUrl);
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
