import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "init-run.ts");

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("init-run seeds initial formatting decision into manifest", async () => {
  const root = await makeTempDir("tujie-init-run-");
  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    SCRIPT_PATH,
    "--slug",
    "agent-workflow",
    "--topic",
    "为什么 AI Agent 需要多阶段工作流",
    "--work-type",
    "article",
    "--output-dir",
    "runs",
    "--category",
    "ai-tech",
    "--priority-tier",
    "3",
    "--knowledge-angle",
    "模型能力、工具调用、工作流拆解与边界",
  ], { cwd: root });

  const parsed = JSON.parse(stdout.trim()) as { manifest: string };
  const manifest = JSON.parse(await fs.readFile(parsed.manifest, "utf-8")) as {
    formatting: {
      selected_theme: string;
      theme_selection_mode: string;
      theme_candidates: string[];
    };
  };

  assert.equal(manifest.formatting.theme_selection_mode, "auto");
  assert.ok(["bytedance", "github", "sspai"].includes(manifest.formatting.selected_theme));
  assert.ok(manifest.formatting.theme_candidates.length >= 1);
});
