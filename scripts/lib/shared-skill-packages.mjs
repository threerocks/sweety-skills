import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const PACKAGE_DEPENDENCY_SECTIONS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
];

const SKIPPED_DIRS = new Set([".git", ".clawhub", ".clawdhub", "node_modules"]);
const SKIPPED_FILES = new Set([".DS_Store"]);

export async function syncSharedSkillPackages(repoRoot, options = {}) {
  const root = path.resolve(repoRoot);
  const workspacePackages = await discoverWorkspacePackages(root);
  const targetConsumerDirs = normalizeTargetConsumerDirs(root, options.targets ?? []);
  const consumers = await discoverSkillScriptPackages(root, targetConsumerDirs);
  const runtime = options.install === false ? null : resolveBunRuntime();
  const managedPaths = new Set();
  const packageDirs = [];

  for (const consumer of consumers) {
    const result = await syncConsumerPackage({
      consumer,
      root,
      workspacePackages,
      runtime,
    });
    if (!result) continue;

    packageDirs.push(consumer.dir);
    for (const managedPath of result.managedPaths) {
      managedPaths.add(managedPath);
    }
  }

  return {
    packageDirs,
    managedPaths: [...managedPaths].sort(),
  };
}

function normalizeTargetConsumerDirs(repoRoot, targets) {
  if (!targets || targets.length === 0) return null;

  const consumerDirs = new Set();
  for (const target of targets) {
    if (!target) continue;

    const resolvedTarget = path.resolve(repoRoot, target);
    if (path.basename(resolvedTarget) === "scripts") {
      consumerDirs.add(resolvedTarget);
      continue;
    }

    consumerDirs.add(path.join(resolvedTarget, "scripts"));
  }

  return consumerDirs;
}

export function ensureManagedPathsClean(repoRoot, managedPaths) {
  if (managedPaths.length === 0) return;

  const result = spawnSync("git", ["status", "--porcelain", "--", ...managedPaths], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Failed to inspect git status for managed paths");
  }

  const output = result.stdout.trim();
  if (!output) return;

  throw new Error(
    [
      "Shared skill package sync produced uncommitted managed changes.",
      "Review and commit these files before pushing:",
      output,
    ].join("\n"),
  );
}

async function syncConsumerPackage({ consumer, root, workspacePackages, runtime }) {
  const packageJsonPath = path.join(consumer.dir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const localDeps = collectLocalDependencies(packageJson, workspacePackages);
  if (localDeps.length === 0) {
    return null;
  }

  const vendorRoot = path.join(consumer.dir, "vendor");
  await fs.rm(vendorRoot, { recursive: true, force: true });

  for (const name of localDeps) {
    const sourceDir = workspacePackages.get(name);
    if (!sourceDir) continue;
    await syncPackageTree({
      sourceDir,
      targetDir: path.join(vendorRoot, name),
      workspacePackages,
    });
  }

  rewriteLocalDependencySpecs(packageJson, localDeps);
  await writeJson(packageJsonPath, packageJson);

  if (runtime) {
    runInstall(runtime, consumer.dir);
  }

  const managedPaths = [
    path.relative(root, packageJsonPath).split(path.sep).join("/"),
    path.relative(root, path.join(consumer.dir, "bun.lock")).split(path.sep).join("/"),
    path.relative(root, vendorRoot).split(path.sep).join("/"),
  ];

  return { managedPaths };
}

async function syncPackageTree({ sourceDir, targetDir, workspacePackages }) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  const sourcePackageJsonPath = path.join(sourceDir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(sourcePackageJsonPath, "utf8"));
  const localDeps = collectLocalDependencies(packageJson, workspacePackages);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry.name) || SKIPPED_FILES.has(entry.name)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile() || entry.name === "package.json") continue;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }

  for (const name of localDeps) {
    const nestedSourceDir = workspacePackages.get(name);
    if (!nestedSourceDir) continue;
    await syncPackageTree({
      sourceDir: nestedSourceDir,
      targetDir: path.join(targetDir, "vendor", name),
      workspacePackages,
    });
  }

  rewriteLocalDependencySpecs(packageJson, localDeps);
  await writeJson(path.join(targetDir, "package.json"), packageJson);
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry.name) || SKIPPED_FILES.has(entry.name)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) continue;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}

async function discoverWorkspacePackages(repoRoot) {
  const packagesRoot = path.join(repoRoot, "packages");
  const map = new Map();
  if (!existsSync(packagesRoot)) return map;

  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = path.join(packagesRoot, entry.name, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    if (!packageJson.name) continue;
    map.set(packageJson.name, path.join(packagesRoot, entry.name));
  }

  return map;
}

async function discoverSkillScriptPackages(repoRoot, targetConsumerDirs = null) {
  const skillsRoot = path.join(repoRoot, "skills");
  const consumers = [];
  const skillEntries = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;
    const scriptsDir = path.join(skillsRoot, entry.name, "scripts");
    if (targetConsumerDirs && !targetConsumerDirs.has(path.resolve(scriptsDir))) continue;
    const packageJsonPath = path.join(scriptsDir, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    consumers.push({ dir: scriptsDir, packageJsonPath });
  }
  return consumers.sort((left, right) => left.dir.localeCompare(right.dir));
}

function collectLocalDependencies(packageJson, workspacePackages) {
  const localDeps = [];
  for (const section of PACKAGE_DEPENDENCY_SECTIONS) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== "object") continue;

    for (const name of Object.keys(dependencies)) {
      if (!workspacePackages.has(name)) continue;
      localDeps.push(name);
    }
  }

  return [...new Set(localDeps)].sort();
}

function rewriteLocalDependencySpecs(packageJson, localDeps) {
  for (const section of PACKAGE_DEPENDENCY_SECTIONS) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== "object") continue;

    for (const name of localDeps) {
      if (!(name in dependencies)) continue;
      dependencies[name] = `file:./vendor/${name}`;
    }
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveBunRuntime() {
  if (commandExists("bun")) {
    return { command: "bun", args: [] };
  }
  if (commandExists("npx")) {
    return { command: "npx", args: ["-y", "bun"] };
  }
  throw new Error(
    "Neither bun nor npx is installed. Install bun with `brew install oven-sh/bun/bun` or `npm install -g bun`.",
  );
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function runInstall(runtime, cwd) {
  const result = spawnSync(runtime.command, [...runtime.args, "install"], {
    cwd,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to refresh Bun dependencies in ${cwd}`);
  }
}
