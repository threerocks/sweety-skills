#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_REGISTRY = "https://clawhub.ai";
const TEXT_EXTENSIONS = new Set([
  "md",
  "mdx",
  "txt",
  "json",
  "json5",
  "yaml",
  "yml",
  "toml",
  "js",
  "cjs",
  "mjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "sh",
  "rb",
  "go",
  "rs",
  "swift",
  "kt",
  "java",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "sql",
  "csv",
  "ini",
  "cfg",
  "env",
  "xml",
  "html",
  "css",
  "scss",
  "sass",
  "svg",
]);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = await readClawhubConfig();
  const registry = (
    process.env.CLAWHUB_REGISTRY ||
    process.env.CLAWDHUB_REGISTRY ||
    config.registry ||
    DEFAULT_REGISTRY
  ).replace(/\/+$/, "");

  if (!config.token) {
    throw new Error("Not logged in. Run: clawhub login");
  }

  await apiJson(registry, config.token, "/api/v1/whoami");

  const roots = options.roots.length > 0 ? options.roots : [path.resolve("skills")];
  const skills = await findSkills(roots);

  if (skills.length === 0) {
    throw new Error("No skills found.");
  }

  console.log("ClawHub sync");
  console.log(`Roots with skills: ${roots.join(", ")}`);

  const locals = await mapWithConcurrency(skills, options.concurrency, async (skill) => {
    const files = await listTextFiles(skill.folder);
    const fingerprint = buildFingerprint(files);
    return {
      ...skill,
      fileCount: files.length,
      fingerprint,
    };
  });

  const candidates = await mapWithConcurrency(locals, options.concurrency, async (skill) => {
    const query = new URLSearchParams({
      slug: skill.slug,
      hash: skill.fingerprint,
    });
    const { status, body } = await apiJsonWithStatus(
      registry,
      config.token,
      `/api/v1/resolve?${query.toString()}`
    );

    if (status === 404) {
      return {
        ...skill,
        status: "new",
        latestVersion: null,
        matchVersion: null,
      };
    }

    if (status !== 200) {
      throw new Error(body?.message || `Resolve failed for ${skill.slug} (HTTP ${status})`);
    }

    const latestVersion = body?.latestVersion?.version ?? null;
    const matchVersion = body?.match?.version ?? null;

    if (!latestVersion) {
      return {
        ...skill,
        status: "new",
        latestVersion: null,
        matchVersion: null,
      };
    }

    return {
      ...skill,
      status: matchVersion ? "synced" : "update",
      latestVersion,
      matchVersion,
    };
  });

  const actionable = candidates.filter((candidate) => candidate.status !== "synced");
  if (actionable.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  console.log("");
  console.log("To sync");
  for (const candidate of actionable) {
    console.log(`- ${formatCandidate(candidate, options.bump)}`);
  }

  if (options.dryRun) {
    console.log("");
    console.log(`Dry run: would upload ${actionable.length} skill(s).`);
    return;
  }

  const tags = options.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  let succeeded = 0;
  const failed = [];

  for (const candidate of actionable) {
    const version =
      candidate.status === "new"
        ? "1.0.0"
        : bumpSemver(candidate.latestVersion, options.bump);

    console.log(`Publishing ${candidate.slug}@${version}`);
    try {
      const files = await listTextFiles(candidate.folder);
      await publishSkill({
        registry,
        token: config.token,
        skill: candidate,
        files,
        version,
        changelog: options.changelog,
        tags,
      });
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`SKIPPED ${candidate.slug}: ${msg}`);
      failed.push(candidate.slug);
    }
  }

  console.log("");
  console.log(`Uploaded ${succeeded}/${actionable.length} skill(s).`);
  if (failed.length > 0) {
    console.log(`Failed (${failed.length}): ${failed.join(", ")}`);
  }
}

function parseArgs(argv) {
  const options = {
    roots: [],
    dryRun: false,
    bump: "patch",
    changelog: "",
    tags: "latest",
    concurrency: 4,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--all") {
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--root requires a directory");
      options.roots.push(path.resolve(value));
      index += 1;
      continue;
    }
    if (arg === "--bump") {
      const value = argv[index + 1];
      if (!["patch", "minor", "major"].includes(value)) {
        throw new Error("--bump must be patch, minor, or major");
      }
      options.bump = value;
      index += 1;
      continue;
    }
    if (arg === "--changelog") {
      const value = argv[index + 1];
      if (value == null) throw new Error("--changelog requires text");
      options.changelog = value;
      index += 1;
      continue;
    }
    if (arg === "--tags") {
      const value = argv[index + 1];
      if (value == null) throw new Error("--tags requires a value");
      options.tags = value;
      index += 1;
      continue;
    }
    if (arg === "--concurrency") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 32) {
        throw new Error("--concurrency must be an integer between 1 and 32");
      }
      options.concurrency = value;
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: sync-clawhub.mjs [options]

Options:
  --root <dir>         Extra skill root (repeatable)
  --all                Accepted for compatibility
  --dry-run            Show what would be uploaded
  --bump <type>        patch | minor | major
  --changelog <text>   Changelog for updates
  --tags <tags>        Comma-separated tags
  --concurrency <n>    Registry check concurrency (1-32)
  -h, --help           Show help`);
}

async function readClawhubConfig() {
  const configPath = getConfigPath();
  try {
    return JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch {
    return {};
  }
}

function getConfigPath() {
  const override =
    process.env.CLAWHUB_CONFIG_PATH?.trim() || process.env.CLAWDHUB_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(override);
  }

  const home = os.homedir();
  if (process.platform === "darwin") {
    const clawhub = path.join(home, "Library", "Application Support", "clawhub", "config.json");
    const clawdhub = path.join(home, "Library", "Application Support", "clawdhub", "config.json");
    return pathForExistingConfig(clawhub, clawdhub);
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    const clawhub = path.join(xdg, "clawhub", "config.json");
    const clawdhub = path.join(xdg, "clawdhub", "config.json");
    return pathForExistingConfig(clawhub, clawdhub);
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    const clawhub = path.join(process.env.APPDATA, "clawhub", "config.json");
    const clawdhub = path.join(process.env.APPDATA, "clawdhub", "config.json");
    return pathForExistingConfig(clawhub, clawdhub);
  }

  const clawhub = path.join(home, ".config", "clawhub", "config.json");
  const clawdhub = path.join(home, ".config", "clawdhub", "config.json");
  return pathForExistingConfig(clawhub, clawdhub);
}

function pathForExistingConfig(primary, legacy) {
  if (existsSync(primary)) return path.resolve(primary);
  if (existsSync(legacy)) return path.resolve(legacy);
  return path.resolve(primary);
}

async function findSkills(roots) {
  const deduped = new Map();
  for (const root of roots) {
    const folders = await findSkillFolders(root);
    for (const folder of folders) {
      deduped.set(folder.slug, folder);
    }
  }
  return [...deduped.values()].sort((left, right) => left.slug.localeCompare(right.slug));
}

async function findSkillFolders(root) {
  const stat = await safeStat(root);
  if (!stat?.isDirectory()) return [];

  if (await hasSkillMarker(root)) {
    return [buildSkillEntry(root)];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(root, entry.name);
    if (await hasSkillMarker(folder)) {
      found.push(buildSkillEntry(folder));
    }
  }
  return found;
}

function buildSkillEntry(folder) {
  const base = path.basename(folder);
  return {
    folder,
    slug: sanitizeSlug(base),
    displayName: titleCase(base),
  };
}

async function hasSkillMarker(folder) {
  return Boolean(
    (await safeStat(path.join(folder, "SKILL.md")))?.isFile() ||
      (await safeStat(path.join(folder, "skill.md")))?.isFile()
  );
}

async function listTextFiles(root) {
  const files = [];

  async function walk(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.name === ".clawhub" || entry.name === ".clawdhub") continue;

      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relPath = path.relative(root, fullPath).split(path.sep).join("/");
      const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      const bytes = await fs.readFile(fullPath);
      files.push({ relPath, bytes });
    }
  }

  await walk(root);
  files.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return files;
}

function buildFingerprint(files) {
  const payload = files
    .map((file) => `${file.relPath}:${sha256(file.bytes)}`)
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function publishSkill({ registry, token, skill, files, version, changelog, tags }) {
  const form = new FormData();
  form.set(
    "payload",
    JSON.stringify({
      slug: skill.slug,
      displayName: skill.displayName,
      version,
      changelog,
      tags,
      acceptLicenseTerms: true,
    })
  );

  for (const file of files) {
    form.append("files", new Blob([file.bytes], { type: "text/plain" }), file.relPath);
  }

  const response = await fetch(`${registry}/api/v1/skills`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Publish failed for ${skill.slug} (HTTP ${response.status})`);
  }

  const result = text ? JSON.parse(text) : {};
  console.log(`OK. Published ${skill.slug}@${version}${result.versionId ? ` (${result.versionId})` : ""}`);
}

async function apiJson(registry, token, requestPath) {
  const { status, body } = await apiJsonWithStatus(registry, token, requestPath);
  if (status < 200 || status >= 300) {
    throw new Error(body?.message || `HTTP ${status}`);
  }
  return body;
}

async function apiJsonWithStatus(registry, token, requestPath) {
  const response = await fetch(`${registry}${requestPath}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  return { status: response.status, body };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const count = Math.min(Math.max(limit, 1), Math.max(items.length, 1));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

function formatCandidate(candidate, bump) {
  if (candidate.status === "new") {
    return `${candidate.slug}  NEW  (${candidate.fileCount} files)`;
  }
  return `${candidate.slug}  UPDATE ${candidate.latestVersion} -> ${bumpSemver(
    candidate.latestVersion,
    bump
  )}  (${candidate.fileCount} files)`;
}

function bumpSemver(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function sanitizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/--+/g, "-");
}

function titleCase(value) {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
