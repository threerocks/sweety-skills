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
const RUN_SCRIPT = path.join(__dirname, "run.ts");
const SYNC_SCRIPT = path.join(__dirname, "catalog-sync.ts");

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function seedDataDir(root: string): Promise<string> {
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
  return dataDir;
}

test("course run prepares markdown and advances chapter only after publish success", { timeout: 120000 }, async () => {
  const root = await makeTempDir("ai-cat-run-");
  const dataDir = await seedDataDir(root);

  await execFileAsync("npx", ["-y", "bun", SYNC_SCRIPT, "--track", "adult", "--data-dir", dataDir], {
    cwd: REPO_ROOT,
  });

  const fakePublisher = path.join(root, "fake-publish.ts");
  await fs.writeFile(fakePublisher, `
console.log(JSON.stringify({ ok: true, fallback_to_article: false, result: { media_id: "draft-001" }, errors: [] }, null, 2));
`, "utf8");

  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    RUN_SCRIPT,
    "--slot",
    "adult",
    "--account",
    "demo",
    "--publish",
    "--data-dir",
    dataDir,
  ], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      AI_CAT_PUBLISH_WITH_FALLBACK_SCRIPT: fakePublisher,
      AI_CAT_ENABLE_IMAGE_GEN: "0",
    },
  });

  const parsed = JSON.parse(stdout.trim()) as { run: { status: string; item_no: number; title: string } };
  assert.equal(parsed.run.status, "published");
  assert.equal(parsed.run.item_no, 1);
  assert.match(parsed.run.title, /01/);

  const trackState = JSON.parse(await fs.readFile(path.join(dataDir, "track-state.json"), "utf8")) as {
    tracks: { adult: { current_item_index: number } };
  };
  assert.equal(trackState.tracks.adult.current_item_index, 1);
});

test("evening slot falls back to portfolio course when no practical hot case exists", { timeout: 120000 }, async () => {
  const root = await makeTempDir("ai-cat-evening-");
  const dataDir = await seedDataDir(root);
  await execFileAsync("npx", ["-y", "bun", SYNC_SCRIPT, "--track", "portfolio", "--data-dir", dataDir], {
    cwd: REPO_ROOT,
  });

  const hotCaseFile = path.join(root, "hot-cases.json");
  await fs.writeFile(hotCaseFile, JSON.stringify([
    {
      id: "case-1",
      title: "纯新闻通稿",
      summary: "没有实操细节",
      source_url: "https://example.com/news",
      source_name: "Example",
      published_at: new Date().toISOString(),
      score: 90,
      is_practical: false
    }
  ], null, 2), "utf8");

  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    RUN_SCRIPT,
    "--slot",
    "evening",
    "--account",
    "demo",
    "--data-dir",
    dataDir,
    "--hot-case-file",
    hotCaseFile,
  ], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      AI_CAT_ENABLE_IMAGE_GEN: "0",
    },
  });

  const parsed = JSON.parse(stdout.trim()) as { run: { source_kind: string; course_id: string | null } };
  assert.equal(parsed.run.source_kind, "course");
  assert.equal(parsed.run.course_id, "ai-portfolio-course");
});

test("kids slot uses source-backed lesson pack for research brief and markdown", { timeout: 120000 }, async () => {
  const root = await makeTempDir("ai-cat-kids-");
  const dataDir = await seedDataDir(root);

  const { stdout } = await execFileAsync("npx", [
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
    env: {
      ...process.env,
      AI_CAT_ENABLE_IMAGE_GEN: "0",
    },
  });

  const parsed = JSON.parse(stdout.trim()) as { markdown_path: string; manifest_path: string; run: { course_id: string } };
  assert.equal(parsed.run.course_id, "kepu-weekly-ai-laile-2026-03");

  const markdown = await fs.readFile(parsed.markdown_path, "utf8");
  const briefPath = path.join(path.dirname(path.dirname(parsed.manifest_path)), "research", "brief.json");
  const brief = JSON.parse(await fs.readFile(briefPath, "utf8")) as { opening_scene: string; evidence: Array<{ source_url: string }> };

  assert.match(markdown, /这一讲最重要的三句话/);
  assert.ok(typeof brief.opening_scene === "string" && brief.opening_scene.length > 20);
  assert.ok(markdown.includes(brief.opening_scene));
  assert.ok(Array.isArray(brief.evidence) && brief.evidence.length >= 1);
});
