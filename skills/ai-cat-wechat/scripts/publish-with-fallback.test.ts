import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DATA_ROOT = path.join(REPO_ROOT, "skills", "ai-cat-wechat", "fixtures");
const SCRIPT_PATH = path.join(__dirname, "publish-with-fallback.ts");
const RUN_SCRIPT = path.join(__dirname, "run.ts");
const SYNC_SCRIPT = path.join(__dirname, "catalog-sync.ts");

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("publish wrapper falls back from poster to article when first publish fails", { timeout: 120000 }, async () => {
  const root = await makeTempDir("ai-cat-publish-");
  const dataDir = path.join(root, ".sweety-skills", "ai-cat-wechat");
  await fs.mkdir(dataDir, { recursive: true });
  for (const name of ["course-watchlists.json", "track-state.json", "course-catalogs.json", "run-history.json", "hot-case-history.json"]) {
    await fs.copyFile(path.join(DATA_ROOT, name), path.join(dataDir, name));
  }
  await fs.writeFile(path.join(dataDir, "EXTEND.md"), [
    "timezone: Asia/Shanghai",
    `default_output_dir: ${path.join(root, "runs")}`,
    "wechat_publish_mode: draft",
    "image_strategy: poster-first",
    "slot_times.kids: 08:00",
    "slot_times.adult: 12:00",
    "slot_times.evening: 18:00",
    "slot_times.news: 21:00",
    "catalog_min_items: 3",
    "hot_case.lookback_hours: 24",
    "hot_case.min_score: 70",
    "hot_case.max_items: 5",
    "news.lookback_hours: 24",
    "news.digest_count: 4",
    "news.min_items: 3",
    "news.max_items: 5",
    "poster_to_article_on_publish_failure: true",
    "image_provider_fallback_order: google,relay,dashscope",
    "",
  ].join("\n"), "utf8");

  await execFileAsync("npx", ["-y", "bun", SYNC_SCRIPT, "--track", "kids", "--data-dir", dataDir], {
    cwd: REPO_ROOT,
  });

  const runEnv = {
    ...process.env,
    AI_CAT_ENABLE_IMAGE_GEN: "0",
  };

  const { stdout: prepStdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    RUN_SCRIPT,
    "--slot",
    "kids",
    "--account",
    "demo",
    "--data-dir",
    dataDir,
  ], {
    cwd: REPO_ROOT,
    env: runEnv,
  });

  const prepared = JSON.parse(prepStdout.trim()) as { markdown_path: string; manifest_path: string };

  const fakePublisher = path.join(root, "fake-publish.ts");
  await fs.writeFile(fakePublisher, `
const file = process.argv[2];
if (file.endsWith("poster.md")) {
  console.error("poster failed");
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, result: { media_id: "article-ok" } }, null, 2));
`, "utf8");

  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    SCRIPT_PATH,
    "--file",
    prepared.markdown_path,
    "--work-type",
    "poster",
    "--account",
    "demo",
    "--manifest",
    prepared.manifest_path,
    "--dry-run",
  ], {
    cwd: REPO_ROOT,
    env: {
      ...runEnv,
      AI_CAT_PUBLISH_DRAFT_SCRIPT: fakePublisher,
    },
  });

  const parsed = JSON.parse(stdout.trim()) as { ok: boolean; fallback_to_article: boolean };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.fallback_to_article, true);
});
