import fs from "node:fs";
import path from "node:path";

interface TopicDirReport {
  topic_root: string;
  status: string;
  age_days: number;
  size_bytes: number;
  reclaimable_bytes: number;
  actions: string[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun storage-gc.ts [--root wechat-tujie-wanwu] [--keep-days 30] [--prune-prompts] [--prune-temporary] [--apply]

Behavior:
  - 默认 dry-run，只汇报可回收空间
  - --prune-prompts: 删除已完成任务中的 prompts 目录
  - --prune-temporary: 删除测试或长期未完成任务目录
  - --apply: 真正执行删除`);
  process.exit(1);
}

function walkSize(targetPath: string): number {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  const entries = fs.readdirSync(targetPath);
  return entries.reduce((sum, entry) => sum + walkSize(path.join(targetPath, entry)), 0);
}

function removePath(targetPath: string): void {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function listTopicRoots(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const dateDirs = fs.readdirSync(rootDir)
    .map((name) => path.join(rootDir, name))
    .filter((fullPath) => fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory());
  return dateDirs.flatMap((dateDir) => (
    fs.readdirSync(dateDir)
      .map((name) => path.join(dateDir, name))
      .filter((fullPath) => fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory())
  ));
}

function readManifest(topicRoot: string): { status: string; createdAt: string | null } {
  const manifestPath = path.join(topicRoot, "publish", "manifest.json");
  if (!fs.existsSync(manifestPath)) return { status: "unknown", createdAt: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { status?: string; created_at?: string };
    return {
      status: parsed.status || "unknown",
      createdAt: parsed.created_at || null,
    };
  } catch {
    return { status: "unknown", createdAt: null };
  }
}

function ageDays(createdAt: string | null): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.floor(Math.abs(Date.now() - created.getTime()) / 86400000);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function main(): void {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
  }
  const rootDir = path.resolve(getArg("--root") || "wechat-tujie-wanwu");
  const keepDays = Number(getArg("--keep-days") || "30");
  const prunePrompts = hasFlag("--prune-prompts");
  const pruneTemporary = hasFlag("--prune-temporary");
  const apply = hasFlag("--apply");

  if (!fs.existsSync(rootDir)) {
    printUsage();
  }

  const reports: TopicDirReport[] = [];
  let totalBytes = 0;
  let reclaimableBytes = 0;

  for (const topicRoot of listTopicRoots(rootDir)) {
    const { status, createdAt } = readManifest(topicRoot);
    const dirAgeDays = ageDays(createdAt);
    const sizeBytes = walkSize(topicRoot);
    const actions: string[] = [];
    let reclaim = 0;

    const promptDir = path.join(topicRoot, "prompts");
    if (prunePrompts && status === "completed" && fs.existsSync(promptDir)) {
      const promptBytes = walkSize(promptDir);
      reclaim += promptBytes;
      actions.push(`删除 prompts/ 可回收 ${formatBytes(promptBytes)}`);
      if (apply) removePath(promptDir);
    }

    const topicName = path.basename(topicRoot);
    const isTemporary = topicName.startsWith("test-") || topicName.includes("policy-test") || status === "initialized" || status === "publish_failed";
    if (pruneTemporary && isTemporary && dirAgeDays >= keepDays) {
      reclaim += sizeBytes;
      actions.push(`删除临时任务目录，可回收 ${formatBytes(sizeBytes)}`);
      if (apply) removePath(topicRoot);
    }

    totalBytes += sizeBytes;
    reclaimableBytes += reclaim;
    reports.push({
      topic_root: topicRoot,
      status,
      age_days: dirAgeDays,
      size_bytes: sizeBytes,
      reclaimable_bytes: reclaim,
      actions,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    apply,
    root: rootDir,
    total_bytes: totalBytes,
    total_size: formatBytes(totalBytes),
    reclaimable_bytes: reclaimableBytes,
    reclaimable_size: formatBytes(reclaimableBytes),
    reports,
  }, null, 2));
}

main();
