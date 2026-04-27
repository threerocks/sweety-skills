import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";

import type { CliArgs, ExtendConfig } from "./types.ts";
import {
  createTaskArgs,
  detectProvider,
  detectProviderChain,
  getConfiguredMaxWorkers,
  getProviderFallbackOrder,
  getConfiguredProviderRateLimits,
  getTargetDimensions,
  getWorkerCount,
  hasAspectMismatch,
  inspectImageData,
  isRetryableGenerationError,
  loadBatchTasks,
  mergeConfig,
  normalizeOutputImagePath,
  outputFormatFromPath,
  parseArgs,
  parseAspectRatioValue,
  parseRequestedSize,
  parseSimpleYaml,
  standardizeImageData,
} from "./main.ts";

function makeArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
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
    ...overrides,
  };
}

function useEnv(
  t: TestContext,
  values: Record<string, string | null>,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  t.after(() => {
    for (const [key, value] of previous.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function loadSharpForTest(): any | null {
  const require = createRequire(import.meta.url);
  for (const candidate of [
    "sharp",
    path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
      "sharp",
    ),
  ]) {
    try {
      return require(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

test("parseArgs parses the main image-gen CLI flags", () => {
  const args = parseArgs([
    "--promptfiles",
    "prompts/system.md",
    "prompts/content.md",
    "--image",
    "out/hero",
    "--provider",
    "openai",
    "--quality",
    "2k",
    "--imageSize",
    "4k",
    "--ref",
    "ref/one.png",
    "ref/two.jpg",
    "--n",
    "3",
    "--jobs",
    "5",
    "--json",
  ]);

  assert.deepEqual(args.promptFiles, ["prompts/system.md", "prompts/content.md"]);
  assert.equal(args.imagePath, "out/hero");
  assert.equal(args.provider, "openai");
  assert.equal(args.quality, "2k");
  assert.equal(args.imageSize, "4K");
  assert.deepEqual(args.referenceImages, ["ref/one.png", "ref/two.jpg"]);
  assert.equal(args.n, 3);
  assert.equal(args.jobs, 5);
  assert.equal(args.json, true);
});

test("parseArgs falls back to positional prompt and rejects invalid provider", () => {
  const positional = parseArgs(["draw", "a", "cat"]);
  assert.equal(positional.prompt, "draw a cat");

  assert.throws(
    () => parseArgs(["--provider", "stability"]),
    /Invalid provider/,
  );
});

test("parseSimpleYaml parses nested defaults and provider limits", () => {
  const yaml = `
version: 2
default_provider: openrouter
provider_fallback_order:
  - relay
  - dashscope
default_quality: normal
default_aspect_ratio: '16:9'
default_image_size: 2K
default_model:
  google: gemini-3-pro-image-preview
  openai: gpt-image-1.5
batch:
  max_workers: 8
  provider_limits:
    google:
      concurrency: 2
      start_interval_ms: 900
    openai:
      concurrency: 4
`;

  const config = parseSimpleYaml(yaml);

  assert.equal(config.version, 2);
  assert.equal(config.default_provider, "openrouter");
  assert.deepEqual(config.provider_fallback_order, ["relay", "dashscope"]);
  assert.equal(config.default_quality, "normal");
  assert.equal(config.default_aspect_ratio, "16:9");
  assert.equal(config.default_image_size, "2K");
  assert.equal(config.default_model?.google, "gemini-3-pro-image-preview");
  assert.equal(config.default_model?.openai, "gpt-image-1.5");
  assert.equal(config.batch?.max_workers, 8);
  assert.deepEqual(config.batch?.provider_limits?.google, {
    concurrency: 2,
    start_interval_ms: 900,
  });
  assert.deepEqual(config.batch?.provider_limits?.openai, {
    concurrency: 4,
  });
});

test("mergeConfig only fills values missing from CLI args", () => {
  const merged = mergeConfig(
    makeArgs({
      provider: "openai",
      quality: null,
      aspectRatio: null,
      imageSize: "4K",
    }),
    {
      default_provider: "google",
      default_quality: "2k",
      default_aspect_ratio: "3:2",
      default_image_size: "2K",
    } satisfies Partial<ExtendConfig>,
  );

  assert.equal(merged.provider, "openai");
  assert.equal(merged.quality, "2k");
  assert.equal(merged.aspectRatio, "3:2");
  assert.equal(merged.imageSize, "4K");
});

test("mergeConfig keeps provider null in auto mode so fallback ordering still works", () => {
  const merged = mergeConfig(makeArgs(), {
    default_provider: "google",
    default_quality: "2k",
  } satisfies Partial<ExtendConfig>);

  assert.equal(merged.provider, null);
  assert.equal(merged.quality, "2k");
});

test("detectProvider rejects non-ref-capable providers and prefers Google first when multiple keys exist", (t) => {
  assert.throws(
    () =>
      detectProvider(
        makeArgs({
          provider: "dashscope",
          referenceImages: ["ref.png"],
        }),
      ),
    /Reference images require a ref-capable provider/,
  );

  useEnv(t, {
    GOOGLE_API_KEY: "google-key",
    OPENAI_API_KEY: "openai-key",
    OPENROUTER_API_KEY: null,
    DASHSCOPE_API_KEY: null,
    REPLICATE_API_TOKEN: null,
    JIMENG_ACCESS_KEY_ID: null,
    JIMENG_SECRET_ACCESS_KEY: null,
    ARK_API_KEY: null,
  });
  assert.equal(detectProvider(makeArgs()), "google");
});

test("provider fallback order honors EXTEND config and skips unsupported ref providers", (t) => {
  useEnv(t, {
    GOOGLE_API_KEY: "google-key",
    RELAY_API_KEY: "relay-key",
    DASHSCOPE_API_KEY: "dashscope-key",
    OPENAI_API_KEY: null,
    OPENROUTER_API_KEY: null,
    REPLICATE_API_TOKEN: null,
    JIMENG_ACCESS_KEY_ID: null,
    JIMENG_SECRET_ACCESS_KEY: null,
    ARK_API_KEY: null,
  });

  const extendConfig: Partial<ExtendConfig> = {
    default_provider: "google",
    provider_fallback_order: ["google", "relay", "dashscope"],
  };

  assert.deepEqual(getProviderFallbackOrder(extendConfig).slice(0, 3), ["google", "relay", "dashscope"]);
  assert.deepEqual(detectProviderChain(makeArgs(), extendConfig).slice(0, 3), ["google", "relay", "dashscope"]);
  assert.deepEqual(
    detectProviderChain(makeArgs({ referenceImages: ["ref.png"] }), {
      provider_fallback_order: ["dashscope", "relay", "google"],
    }).slice(0, 2),
    ["relay", "google"],
  );
});

test("detectProvider selects an available ref-capable provider for reference-image tasks", (t) => {
  useEnv(t, {
    GOOGLE_API_KEY: null,
    OPENAI_API_KEY: "openai-key",
    OPENROUTER_API_KEY: null,
    DASHSCOPE_API_KEY: null,
    REPLICATE_API_TOKEN: null,
    JIMENG_ACCESS_KEY_ID: null,
    JIMENG_SECRET_ACCESS_KEY: null,
    ARK_API_KEY: null,
  });
  assert.equal(
    detectProvider(makeArgs({ referenceImages: ["ref.png"] })),
    "openai",
  );
});

test("detectProvider infers Seedream from model id and allows Seedream reference-image workflows", (t) => {
  useEnv(t, {
    GOOGLE_API_KEY: null,
    OPENAI_API_KEY: null,
    OPENROUTER_API_KEY: null,
    DASHSCOPE_API_KEY: null,
    REPLICATE_API_TOKEN: null,
    JIMENG_ACCESS_KEY_ID: null,
    JIMENG_SECRET_ACCESS_KEY: null,
    ARK_API_KEY: "ark-key",
  });

  assert.equal(
    detectProvider(
      makeArgs({
        model: "doubao-seedream-4-5-251128",
        referenceImages: ["ref.png"],
      }),
    ),
    "seedream",
  );

  assert.equal(
    detectProvider(
      makeArgs({
        provider: "seedream",
        referenceImages: ["ref.png"],
      }),
    ),
    "seedream",
  );
});

test("batch worker and provider-rate-limit configuration prefer env over EXTEND config", (t) => {
  useEnv(t, {
    SWEETY_IMAGE_GEN_MAX_WORKERS: "12",
    SWEETY_IMAGE_GEN_GOOGLE_CONCURRENCY: "5",
    SWEETY_IMAGE_GEN_GOOGLE_START_INTERVAL_MS: "450",
  });

  const extendConfig: Partial<ExtendConfig> = {
    batch: {
      max_workers: 7,
      provider_limits: {
        google: {
          concurrency: 2,
          start_interval_ms: 900,
        },
      },
    },
  };

  assert.equal(getConfiguredMaxWorkers(extendConfig), 12);
  assert.deepEqual(getConfiguredProviderRateLimits(extendConfig).google, {
    concurrency: 5,
    startIntervalMs: 450,
  });
});

test("loadBatchTasks and createTaskArgs resolve batch-relative paths", async (t) => {
  const root = await makeTempDir("sweety-image-gen-batch-");
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const batchFile = path.join(root, "jobs", "batch.json");
  await fs.mkdir(path.dirname(batchFile), { recursive: true });
  await fs.writeFile(
    batchFile,
    JSON.stringify({
      jobs: 2,
      tasks: [
        {
          id: "hero",
          promptFiles: ["prompts/hero.md"],
          image: "out/hero",
          ref: ["refs/hero.png"],
          ar: "16:9",
        },
      ],
    }),
  );

  const loaded = await loadBatchTasks(batchFile);
  assert.equal(loaded.jobs, 2);
  assert.equal(loaded.batchDir, path.dirname(batchFile));
  assert.equal(loaded.tasks[0]?.id, "hero");

  const taskArgs = createTaskArgs(
    makeArgs({
      provider: "replicate",
      quality: "2k",
      json: true,
    }),
    loaded.tasks[0]!,
    loaded.batchDir,
  );

  assert.deepEqual(taskArgs.promptFiles, [
    path.join(loaded.batchDir, "prompts/hero.md"),
  ]);
  assert.equal(taskArgs.imagePath, path.join(loaded.batchDir, "out/hero"));
  assert.deepEqual(taskArgs.referenceImages, [
    path.join(loaded.batchDir, "refs/hero.png"),
  ]);
  assert.equal(taskArgs.provider, "replicate");
  assert.equal(taskArgs.aspectRatio, "16:9");
  assert.equal(taskArgs.quality, "2k");
  assert.equal(taskArgs.json, true);
});

test("path normalization, worker count, and retry classification follow expected rules", () => {
  assert.match(normalizeOutputImagePath("out/sample"), /out[\\/]+sample\.png$/);
  assert.match(normalizeOutputImagePath("out/sample", ".jpg"), /out[\\/]+sample\.jpg$/);
  assert.match(normalizeOutputImagePath("out/sample.webp"), /out[\\/]+sample\.webp$/);

  assert.equal(getWorkerCount(8, null, 3), 3);
  assert.equal(getWorkerCount(2, 6, 5), 2);
  assert.equal(getWorkerCount(5, 0, 4), 1);

  assert.equal(isRetryableGenerationError(new Error("API error (401): denied")), false);
  assert.equal(isRetryableGenerationError(new Error("socket hang up")), true);
});

test("image output helpers parse requested ratio, target size, and file format", () => {
  assert.equal(parseAspectRatioValue("2.35:1"), 2.35);
  assert.equal(parseAspectRatioValue("bad"), null);
  assert.deepEqual(parseRequestedSize("2048x872"), { width: 2048, height: 872 });
  assert.equal(outputFormatFromPath("out/cover.jpg"), "jpeg");
  assert.equal(outputFormatFromPath("out/cover.png"), "png");

  assert.deepEqual(
    getTargetDimensions(makeArgs({ aspectRatio: "2.35:1", quality: "2k" }), {
      format: "jpeg",
      width: 2048,
      height: 2048,
    }),
    { width: 2048, height: 872 },
  );
});

test("image inspection detects JPEG-in-PNG mismatch and aspect mismatch", async (t) => {
  const sharp = loadSharpForTest();
  if (!sharp) {
    t.skip("sharp is unavailable");
    return;
  }

  const jpegSquare = await sharp({
    create: {
      width: 2048,
      height: 2048,
      channels: 3,
      background: "#ffffff",
    },
  }).jpeg().toBuffer();

  const inspected = inspectImageData(jpegSquare);
  assert.equal(inspected.format, "jpeg");
  assert.equal(inspected.width, 2048);
  assert.equal(inspected.height, 2048);
  assert.equal(
    hasAspectMismatch(inspected, makeArgs({ aspectRatio: "2.35:1" })),
    true,
  );

  const standardized = await standardizeImageData(
    jpegSquare,
    path.join(await makeTempDir("sweety-image-standardize-"), "cover.png"),
    makeArgs({ aspectRatio: "2.35:1", quality: "2k" }),
  );

  assert.equal(standardized.standardized, true);
  assert.equal(standardized.metadata.format, "png");
  assert.equal(standardized.metadata.width, 2048);
  assert.equal(standardized.metadata.height, 872);
  assert.match(standardized.postprocess ?? "", /resized from 2048x2048 to 2048x872/);
  assert.match(standardized.postprocess ?? "", /converted jpeg to png/);
});
