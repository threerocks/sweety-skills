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
const SCRIPT_PATH = path.join(__dirname, "catalog-sync.ts");
const DATA_ROOT = path.join(REPO_ROOT, "skills", "ai-cat-wechat", "fixtures");

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("catalog sync validates seeded catalogs and primes initial track cursor", { timeout: 120000 }, async () => {
  const root = await makeTempDir("ai-cat-sync-");
  const dataDir = path.join(root, ".sweety-skills", "ai-cat-wechat");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.copyFile(path.join(DATA_ROOT, "EXTEND.md"), path.join(dataDir, "EXTEND.md"));
  await fs.copyFile(path.join(DATA_ROOT, "course-watchlists.json"), path.join(dataDir, "course-watchlists.json"));
  await fs.writeFile(path.join(dataDir, "course-catalogs.json"), "[]\n", "utf8");
  await fs.writeFile(path.join(dataDir, "run-history.json"), "[]\n", "utf8");
  await fs.writeFile(path.join(dataDir, "hot-case-history.json"), "[]\n", "utf8");
  await fs.copyFile(path.join(DATA_ROOT, "track-state.json"), path.join(dataDir, "track-state.json"));

  const { stdout } = await execFileAsync("npx", ["-y", "bun", SCRIPT_PATH, "--track", "kids", "--data-dir", dataDir], {
    cwd: REPO_ROOT,
  });

  const parsed = JSON.parse(stdout.trim()) as { current_course_id: string; results: Array<{ status: string; item_count: number }> };
  assert.equal(parsed.current_course_id, "kepu-weekly-ai-laile-2026-03");
  assert.ok(parsed.results.some((item) => item.status === "validated" && item.item_count >= 3));
});
