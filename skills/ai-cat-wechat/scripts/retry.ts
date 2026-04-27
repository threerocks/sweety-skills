import { spawnSync } from "node:child_process";
import { ensureAiCatDataDir, loadRunHistory } from "./store.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): void {
  const runId = getArg("--run-id");
  const dataDir = ensureAiCatDataDir(getArg("--data-dir"));
  if (!runId) {
    console.error("Usage: retry.ts --run-id <id> [--data-dir path]");
    process.exit(1);
  }

  const history = loadRunHistory(dataDir);
  const entry = history.find((item) => item.run_id === runId);
  if (!entry) {
    console.error(`run not found: ${runId}`);
    process.exit(1);
  }

  const result = spawnSync("npx", [
    "-y",
    "bun",
    `${process.cwd()}/skills/ai-cat-wechat/scripts/run.ts`,
    "--slot",
    entry.slot,
    "--account",
    entry.account_alias,
    "--date",
    entry.run_date,
    "--publish",
    "--data-dir",
    dataDir,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

main();
