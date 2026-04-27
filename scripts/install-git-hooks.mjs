#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const hooksPath = path.join(repoRoot, ".githooks");

  const result = spawnSync("git", ["config", "core.hooksPath", hooksPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to configure core.hooksPath");
  }

  console.log(`Configured git hooks path: ${hooksPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
