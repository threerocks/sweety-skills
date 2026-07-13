import assert from "node:assert/strict";
import test from "node:test";

import {
  contentTypeFor,
  formatCost,
  joinUrl,
  outputPathFor,
  parseArgs,
  parseExtendYaml,
  pickDownloadUrl,
  resolveConfig,
  type CliArgs,
} from "./main.ts";

function makeArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
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
    ...overrides,
  };
}

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 123,
    state: "success" as const,
    status: "已完成",
    is_final: true,
    progress: "100%",
    result_url: "/uploads/video/x.mp4",
    video_url: "",
    result_type: "video",
    error: "",
    cost: 10,
    ...overrides,
  };
}

test("parseArgs parses generate options", () => {
  const args = parseArgs([
    "--prompt", "a cat", "--ref", "1.jpg", "2.png", "--duration", "15",
    "--ar", "9:16", "--output", "out.mp4", "--no-wait", "--json",
  ]);
  assert.equal(args.prompt, "a cat");
  assert.deepEqual(args.refs, ["1.jpg", "2.png"]);
  assert.equal(args.duration, 15);
  assert.equal(args.aspectRatio, "9:16");
  assert.equal(args.output, "out.mp4");
  assert.equal(args.noWait, true);
  assert.equal(args.json, true);
});

test("parseArgs parses task commands", () => {
  assert.equal(parseArgs(["--status", "42"]).statusId, 42);
  assert.equal(parseArgs(["--wait", "42"]).waitId, 42);
  assert.equal(parseArgs(["--retry", "42"]).retryId, 42);
  assert.equal(parseArgs(["--models"]).models, true);
});

test("parseExtendYaml reads frontmatter fields and skips null", () => {
  const config = parseExtendYaml(`---
version: 1
base_url: https://example.com/
default_model: video-v1
default_duration: 15
default_aspect_ratio: "9:16"
poll_interval_seconds: 10
timeout_minutes: null
---
notes`);
  assert.equal(config.base_url, "https://example.com/");
  assert.equal(config.default_model, "video-v1");
  assert.equal(config.default_duration, 15);
  assert.equal(config.default_aspect_ratio, "9:16");
  assert.equal(config.poll_interval_seconds, 10);
  assert.equal(config.timeout_minutes, undefined);
});

test("resolveConfig precedence: cli > extend > env, with defaults", () => {
  const env = {
    VIDEO_GEN_BASE_URL: "https://env-host/",
    VIDEO_GEN_API_KEY: "env-key",
  };
  const base = resolveConfig(makeArgs(), {}, env);
  assert.equal(base.baseUrl, "https://env-host");
  assert.equal(base.apiKey, "env-key");
  assert.equal(base.model, "video-v1");
  assert.equal(base.duration, 10);
  assert.equal(base.aspectRatio, "16:9");
  assert.equal(base.pollInterval, 15);
  assert.equal(base.timeoutMinutes, 30);

  const extend = resolveConfig(makeArgs(), { base_url: "https://extend-host", default_duration: 5 }, env);
  assert.equal(extend.baseUrl, "https://extend-host");
  assert.equal(extend.duration, 5);

  const cli = resolveConfig(
    makeArgs({ baseUrl: "https://cli-host", duration: 15 }),
    { base_url: "https://extend-host", default_duration: 5 },
    env,
  );
  assert.equal(cli.baseUrl, "https://cli-host");
  assert.equal(cli.duration, 15);
});

test("joinUrl handles relative and absolute urls", () => {
  assert.equal(joinUrl("https://host", "/uploads/a.mp4"), "https://host/uploads/a.mp4");
  assert.equal(joinUrl("https://host/", "uploads/a.mp4"), "https://host/uploads/a.mp4");
  assert.equal(joinUrl("https://host", "https://cdn/a.mp4"), "https://cdn/a.mp4");
});

test("pickDownloadUrl prefers video_url", () => {
  assert.equal(pickDownloadUrl(makeStatus({ video_url: "https://cdn/clean.mp4" }) as never), "https://cdn/clean.mp4");
  assert.equal(pickDownloadUrl(makeStatus() as never), "/uploads/video/x.mp4");
});

test("outputPathFor uses explicit output, else type and extension from url", () => {
  assert.equal(outputPathFor(makeArgs({ output: "a.mp4" }), makeStatus() as never, "https://h/x.mp4"), "a.mp4");
  assert.equal(outputPathFor(makeArgs(), makeStatus() as never, "https://h/uploads/x.mp4"), "video-123.mp4");
  assert.equal(
    outputPathFor(makeArgs(), makeStatus({ task_id: 9, result_type: "image" }) as never, "https://h/x.jpg"),
    "image-9.jpg",
  );
  assert.equal(
    outputPathFor(makeArgs(), makeStatus({ result_type: "image" }) as never, "https://h/noext"),
    "image-123.jpg",
  );
});

test("contentTypeFor maps extensions", () => {
  assert.equal(contentTypeFor("a.jpg"), "image/jpeg");
  assert.equal(contentTypeFor("a.JPEG"), "image/jpeg");
  assert.equal(contentTypeFor("a.png"), "image/png");
  assert.equal(contentTypeFor("a.webp"), "image/webp");
  assert.equal(contentTypeFor("a.bin"), "application/octet-stream");
});

test("parseExtendYaml reads price_per_point", () => {
  assert.equal(parseExtendYaml("price_per_point: 0.8").price_per_point, 0.8);
});

test("formatCost with and without price", () => {
  assert.equal(formatCost(5, null), "5 积分");
  assert.equal(formatCost(5, 0.8), "5 积分 (≈4.00 元)");
});

test("resolveConfig maps price_per_point", () => {
  assert.equal(resolveConfig(makeArgs(), { price_per_point: 0.8 }, {}).pricePerPoint, 0.8);
  assert.equal(resolveConfig(makeArgs(), {}, {}).pricePerPoint, null);
});
