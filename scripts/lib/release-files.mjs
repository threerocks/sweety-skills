import fs from "node:fs/promises";
import path from "node:path";

const PACKAGE_DEPENDENCY_SECTIONS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
];

const SKIPPED_DIRS = new Set([".git", ".clawhub", ".clawdhub", "node_modules", "out", "dist", "build"]);
const SKIPPED_FILES = new Set([".DS_Store", "bun.lockb"]);

export async function listReleaseFiles(root) {
  const resolvedRoot = path.resolve(root);
  const files = [];

  async function walk(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
      if (entry.isFile() && SKIPPED_FILES.has(entry.name)) continue;

      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relPath = path.relative(resolvedRoot, fullPath).split(path.sep).join("/");
      const bytes = await fs.readFile(fullPath);
      files.push({ relPath, bytes });
    }
  }

  await walk(resolvedRoot);
  files.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return files;
}

export async function validateSelfContainedRelease(root) {
  const files = await listReleaseFiles(root);
  for (const file of files.filter((entry) => path.posix.basename(entry.relPath) === "package.json")) {
    const packageDir = path.resolve(root, fromPosixRel(path.posix.dirname(file.relPath)));
    const packageJson = JSON.parse(file.bytes.toString("utf8"));
    for (const section of PACKAGE_DEPENDENCY_SECTIONS) {
      const dependencies = packageJson[section];
      if (!dependencies || typeof dependencies !== "object") continue;

      for (const [name, spec] of Object.entries(dependencies)) {
        if (typeof spec !== "string" || !spec.startsWith("file:")) continue;
        const targetDir = path.resolve(packageDir, spec.slice(5));
        if (!isWithinRoot(root, targetDir)) {
          throw new Error(
            `Release target is not self-contained: ${file.relPath} depends on ${name} via ${spec}`,
          );
        }
        await fs.access(targetDir).catch(() => {
          throw new Error(`Missing local dependency for release: ${file.relPath} -> ${spec}`);
        });
      }
    }
  }
}

function fromPosixRel(relPath) {
  return relPath === "." ? "." : relPath.split("/").join(path.sep);
}

function isWithinRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
