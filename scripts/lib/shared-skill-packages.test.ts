import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncSharedSkillPackages } from "./shared-skill-packages.mjs";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeFile(filePath: string, contents = ""): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("syncSharedSkillPackages vendors workspace packages into skill scripts", async (t) => {
  const root = await makeTempDir("sweety-sync-shared-");
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await writeJson(path.join(root, "packages", "sweety-md", "package.json"), {
    name: "sweety-md",
    version: "1.0.0",
  });
  await writeFile(
    path.join(root, "packages", "sweety-md", "src", "index.ts"),
    "export const markdown = true;\n",
  );

  const consumerDir = path.join(root, "skills", "demo-skill", "scripts");
  await writeJson(path.join(consumerDir, "package.json"), {
    name: "demo-skill-scripts",
    version: "1.0.0",
    dependencies: {
      "sweety-md": "^1.0.0",
      kleur: "^4.1.5",
    },
  });

  const result = await syncSharedSkillPackages(root, { install: false });

  assert.deepEqual(result.packageDirs, [consumerDir]);
  assert.deepEqual(result.managedPaths, [
    "skills/demo-skill/scripts/bun.lock",
    "skills/demo-skill/scripts/package.json",
    "skills/demo-skill/scripts/vendor",
  ]);

  const updatedPackageJson = JSON.parse(
    await fs.readFile(path.join(consumerDir, "package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  assert.equal(updatedPackageJson.dependencies["sweety-md"], "file:./vendor/sweety-md");
  assert.equal(updatedPackageJson.dependencies.kleur, "^4.1.5");

  const vendoredPackageJson = JSON.parse(
    await fs.readFile(path.join(consumerDir, "vendor", "sweety-md", "package.json"), "utf8"),
  ) as { name: string };
  assert.equal(vendoredPackageJson.name, "sweety-md");

  const vendoredFile = await fs.readFile(
    path.join(consumerDir, "vendor", "sweety-md", "src", "index.ts"),
    "utf8",
  );
  assert.match(vendoredFile, /markdown = true/);
});
