import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) {
      values.push(process.argv[i + 1]!);
    }
  }
  return values;
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun ingest-knowledge-notes.ts --title <topic-title> --evidence knowledge-evidence.json --dir research/ \\
    [--findings-output knowledge-findings.json] [--report-output knowledge-evidence-report.json]

  npx -y bun ingest-knowledge-notes.ts --title <topic-title> --evidence knowledge-evidence.json --input note-a.md --input note-b.md \\
    [--default-source-type <source-type>] [--manifest publish/manifest.json] [--plan knowledge-plan.json] [--search knowledge-search.json]

把 research 目录里的原始资料笔记直接抽取、导入、校验，并按需同步回 manifest。`);
  process.exit(1);
}

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) printUsage();
  return value;
}

function scriptPath(name: string): string {
  return path.join(path.dirname(__filename), name);
}

function runScript(scriptName: string, args: string[]): string {
  const result = spawnSync(process.execPath, [scriptPath(scriptName), ...args], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(`${scriptName} 执行失败\n${stderr || stdout || "无输出"}`);
  }

  return (result.stdout || "").trim();
}

function defaultOutputPath(evidencePath: string, fileName: string): string {
  return path.join(path.dirname(path.resolve(evidencePath)), fileName);
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function main(): void {
  const title = requireArg("--title");
  const evidence = requireArg("--evidence");
  const inputs = getArgs("--input");
  const dir = getArg("--dir");
  const defaultSourceType = getArg("--default-source-type");
  const findingsOutput = path.resolve(getArg("--findings-output") || defaultOutputPath(evidence, "knowledge-findings.json"));
  const reportOutput = path.resolve(getArg("--report-output") || defaultOutputPath(evidence, "knowledge-evidence-report.json"));
  const manifest = getArg("--manifest");
  const plan = getArg("--plan");
  const search = getArg("--search");

  if (inputs.length === 0 && !dir) printUsage();

  const extractArgs = ["--title", title, "--output", findingsOutput];
  for (const input of inputs) {
    extractArgs.push("--input", input);
  }
  if (dir) {
    extractArgs.push("--dir", dir);
  }
  if (defaultSourceType) {
    extractArgs.push("--default-source-type", defaultSourceType);
  }

  const extracted = parseJson<{ finding_count?: number; skipped?: string[] }>(
    runScript("extract-knowledge-findings.ts", extractArgs),
  );
  const imported = parseJson<{ imported?: number; skipped?: string[] }>(
    runScript("import-knowledge-findings.ts", ["--evidence", evidence, "--findings", findingsOutput]),
  );
  const validated = parseJson<{ ready_count?: number; task_count?: number }>(
    runScript("validate-knowledge-evidence.ts", ["--input", evidence, "--output", reportOutput]),
  );

  let synced = null;
  if (manifest) {
    const syncArgs = ["--manifest", manifest, "--report", reportOutput, "--evidence", evidence];
    if (plan) syncArgs.push("--plan", plan);
    if (search) syncArgs.push("--search", search);
    synced = parseJson<{ knowledge_ready?: boolean; ready_titles?: string[] }>(
      runScript("sync-knowledge-report.ts", syncArgs),
    );
  }

  console.log(JSON.stringify({
    ok: true,
    title,
    findings_file: findingsOutput,
    evidence_file: path.resolve(evidence),
    report_file: reportOutput,
    extracted_findings: extracted.finding_count || 0,
    extract_skipped: extracted.skipped || [],
    imported_findings: imported.imported || 0,
    import_skipped: imported.skipped || [],
    ready_count: validated.ready_count || 0,
    task_count: validated.task_count || 0,
    manifest_synced: Boolean(synced),
    knowledge_ready: synced?.knowledge_ready ?? null,
    ready_titles: synced?.ready_titles || [],
  }, null, 2));
}

main();
