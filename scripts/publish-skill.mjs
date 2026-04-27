#!/usr/bin/env node

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { listReleaseFiles, validateSelfContainedRelease } from "./lib/release-files.mjs";

const DEFAULT_REGISTRY = "https://clawhub.ai";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.skillDir || !options.version) {
    throw new Error("--skill-dir and --version are required");
  }

  const skillDir = path.resolve(options.skillDir);
  const skill = buildSkillEntry(skillDir, options.slug, options.displayName);
  const changelog = options.changelogFile
    ? await fs.readFile(path.resolve(options.changelogFile), "utf8")
    : "";

  await validateSelfContainedRelease(skillDir);
  const files = await listReleaseFiles(skillDir);
  if (files.length === 0) {
    throw new Error(`Skill directory is empty: ${skillDir}`);
  }

  if (options.dryRun) {
    console.log(`Dry run: would publish ${skill.slug}@${options.version}`);
    console.log(`Skill: ${skillDir}`);
    console.log(`Files: ${files.length}`);
    return;
  }

  const config = await readClawhubConfig();
  const registry = (
    options.registry ||
    process.env.CLAWHUB_REGISTRY ||
    process.env.CLAWDHUB_REGISTRY ||
    config.registry ||
    DEFAULT_REGISTRY
  ).replace(/\/+$/, "");

  if (!config.token) {
    throw new Error("Not logged in. Run: clawhub login");
  }

  await apiJson(registry, config.token, "/api/v1/whoami");

  const tags = options.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  await publishSkill({
    registry,
    token: config.token,
    skill,
    files,
    version: options.version,
    changelog,
    tags,
  });
}

function parseArgs(argv) {
  const options = {
    skillDir: "",
    version: "",
    changelogFile: "",
    registry: "",
    tags: "latest",
    dryRun: false,
    slug: "",
    displayName: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skill-dir") {
      options.skillDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--version") {
      options.version = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--changelog-file") {
      options.changelogFile = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--registry") {
      options.registry = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--tags") {
      options.tags = argv[index + 1] ?? "latest";
      index += 1;
      continue;
    }
    if (arg === "--slug") {
      options.slug = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--display-name") {
      options.displayName = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        options.dryRun = parseBoolean(next);
        index += 1;
      } else {
        options.dryRun = true;
      }
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
  console.log(`Usage: publish-skill.mjs --skill-dir <dir> --version <semver> [options]

Options:
  --skill-dir <dir>        Skill directory to publish
  --version <semver>       Version to publish
  --changelog-file <file>  Release notes file
  --registry <url>         Override registry base URL
  --tags <tags>            Comma-separated tags (default: latest)
  --slug <value>           Override slug
  --display-name <value>   Override display name
  --dry-run                Print publish plan without network calls
  -h, --help               Show help`);
}

function buildSkillEntry(folder, slugOverride, displayNameOverride) {
  const base = path.basename(folder);
  return {
    folder,
    slug: slugOverride || sanitizeSlug(base),
    displayName: displayNameOverride || titleCase(base),
  };
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
    }),
  );

  for (const file of files) {
    form.append("files", new Blob([file.bytes], { type: mimeType(file.relPath) }), file.relPath);
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

  if (response.status < 200 || response.status >= 300) {
    throw new Error(body?.message || `HTTP ${response.status}`);
  }
  return body;
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

const MIME_MAP = {
  ".md": "text/markdown",
  ".ts": "text/plain",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".xml": "text/xml",
  ".svg": "image/svg+xml",
};

function mimeType(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return MIME_MAP[ext] || "text/plain";
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
