import fs from "node:fs";
import path from "node:path";

type RunKind = "manual" | "scheduled";
type WorkType = "article" | "poster";

interface HistoryEntry {
  core_event_key: string;
  angle_key: string;
  topic_slug: string;
  work_type: WorkType;
  drafted_at: string;
  wechat_account_alias: string;
  run_kind: RunKind;
  major_new_development: boolean;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function defaultHistoryPath(): string {
  return path.join(process.cwd(), ".sweety-skills", "tujie-wanwu-wechat", "topic-history.json");
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readHistory(filePath: string): HistoryEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(filePath: string, entries: HistoryEntry[]): void {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function hoursBetween(later: Date, earlier: Date): number {
  return Math.abs(later.getTime() - earlier.getTime()) / 36e5;
}

function pushMatched(target: HistoryEntry[], entry: HistoryEntry): void {
  const alreadyExists = target.some((item) => (
    item.core_event_key === entry.core_event_key &&
    item.angle_key === entry.angle_key &&
    item.topic_slug === entry.topic_slug &&
    item.drafted_at === entry.drafted_at
  ));
  if (!alreadyExists) target.push(entry);
}

function handleCheck(): void {
  const historyPath = getArg("--history") || defaultHistoryPath();
  const coreEventKey = getArg("--core-event-key");
  const angleKey = getArg("--angle-key") || "";
  const dedupeHours = Number(getArg("--dedupe-hours") || "72");
  const runKind = (getArg("--run-kind") || "manual") as RunKind;
  const scheduledAngleWindow = Number(getArg("--scheduled-angle-window") || "3");
  const majorNewDevelopment = hasFlag("--major-new-development");
  const now = new Date(getArg("--now") || new Date().toISOString());

  if (!coreEventKey) {
    console.error("Missing required argument: --core-event-key");
    process.exit(1);
  }

  const entries = readHistory(historyPath);
  const reasons: string[] = [];
  const matched: HistoryEntry[] = [];

  if (!majorNewDevelopment) {
    const recentSameEvent = entries.find((entry) => (
      entry.core_event_key === coreEventKey &&
      hoursBetween(now, new Date(entry.drafted_at)) <= dedupeHours
    ));
    if (recentSameEvent) {
      reasons.push(`72小时内已存在相同核心事件：${recentSameEvent.topic_slug}`);
      pushMatched(matched, recentSameEvent);
    }
  }

  if (runKind === "scheduled" && angleKey) {
    const recentScheduled = entries
      .filter((entry) => entry.run_kind === "scheduled")
      .sort((a, b) => new Date(b.drafted_at).getTime() - new Date(a.drafted_at).getTime())
      .slice(0, scheduledAngleWindow);
    const sameAngle = recentScheduled.find((entry) => entry.angle_key === angleKey);
    if (sameAngle) {
      reasons.push(`最近${scheduledAngleWindow}次定时运行已使用相同角度：${sameAngle.angle_key}`);
      pushMatched(matched, sameAngle);
    }
  }

  const result = {
    ok: reasons.length === 0,
    reasons,
    matched,
    history: historyPath,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
}

function handleRecord(): void {
  const historyPath = getArg("--history") || defaultHistoryPath();
  const coreEventKey = getArg("--core-event-key");
  const angleKey = getArg("--angle-key") || "";
  const topicSlug = getArg("--topic-slug");
  const workType = (getArg("--work-type") || "article") as WorkType;
  const draftedAt = getArg("--drafted-at") || new Date().toISOString();
  const accountAlias = getArg("--wechat-account-alias") || "";
  const runKind = (getArg("--run-kind") || "manual") as RunKind;
  const majorNewDevelopment = hasFlag("--major-new-development");

  if (!coreEventKey || !topicSlug) {
    console.error("Missing required arguments: --core-event-key and --topic-slug");
    process.exit(1);
  }

  const entries = readHistory(historyPath);
  const entry: HistoryEntry = {
    core_event_key: coreEventKey,
    angle_key: angleKey,
    topic_slug: topicSlug,
    work_type: workType,
    drafted_at: draftedAt,
    wechat_account_alias: accountAlias,
    run_kind: runKind,
    major_new_development: majorNewDevelopment,
  };

  entries.push(entry);
  writeHistory(historyPath, entries);

  console.log(JSON.stringify({
    ok: true,
    history: historyPath,
    count: entries.length,
    entry,
  }, null, 2));
}

function handleList(): void {
  const historyPath = getArg("--history") || defaultHistoryPath();
  const entries = readHistory(historyPath);
  console.log(JSON.stringify({
    ok: true,
    history: historyPath,
    count: entries.length,
    entries,
  }, null, 2));
}

function main(): void {
  const command = process.argv[2];
  switch (command) {
    case "check":
      handleCheck();
      return;
    case "record":
      handleRecord();
      return;
    case "list":
      handleList();
      return;
    default:
      console.error("Usage: topic-history.ts <check|record|list> [options]");
      process.exit(1);
  }
}

main();
