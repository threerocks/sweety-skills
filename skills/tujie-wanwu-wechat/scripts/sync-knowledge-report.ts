import fs from "node:fs";
import path from "node:path";

interface Manifest {
  research?: {
    files?: string[];
    selected_sources?: string[];
    knowledge?: {
      plan_file?: string | null;
      search_file?: string | null;
      evidence_file?: string | null;
      report_file?: string | null;
      ready?: boolean;
      ready_titles?: string[];
    };
  };
}

interface ReportItem {
  title: string;
  ready: boolean;
}

interface ReportPayload {
  report?: ReportItem[];
}

interface EvidenceItem {
  source_label?: string;
  source_title?: string;
}

interface EvidenceTask {
  title: string;
  evidence_items?: EvidenceItem[];
}

interface EvidencePayload {
  tasks?: EvidenceTask[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun sync-knowledge-report.ts --manifest publish/manifest.json --report knowledge-evidence-report.json \\
    [--plan knowledge-plan.json] [--search knowledge-search.json] [--evidence knowledge-evidence.json]

将核心知识层文件与校验结果同步回 manifest。`);
  process.exit(1);
}

function toManifestPath(baseDir: string, filePath: string | undefined): string | null {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  const normalizedBase = `${path.resolve(baseDir)}${path.sep}`;
  if (resolved.startsWith(normalizedBase)) {
    return path.relative(baseDir, resolved).split(path.sep).join("/");
  }
  return resolved;
}

function normalizeExistingFiles(baseDir: string, files: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const file of files) {
    const absolute = path.resolve(baseDir, file);
    const manifestPath = toManifestPath(baseDir, absolute);
    if (!manifestPath) continue;
    const dedupeKey = path.resolve(baseDir, manifestPath);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(manifestPath);
  }

  return normalized;
}

function main(): void {
  const manifestArg = getArg("--manifest");
  const reportArg = getArg("--report");
  if (!manifestArg || !reportArg) printUsage();

  const manifestPath = path.resolve(manifestArg);
  const reportPath = path.resolve(reportArg);
  const baseDir = path.dirname(path.dirname(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  const reportPayload = JSON.parse(fs.readFileSync(reportPath, "utf8")) as ReportPayload;
  const evidenceArg = getArg("--evidence");
  const evidencePayload = evidenceArg
    ? JSON.parse(fs.readFileSync(path.resolve(evidenceArg), "utf8")) as EvidencePayload
    : null;
  const readyTitles = (reportPayload.report || []).filter((item) => item.ready).map((item) => item.title);
  const selectedSources = evidencePayload
    ? [...new Set(
        (evidencePayload.tasks || [])
          .filter((task) => readyTitles.includes(task.title))
          .flatMap((task) => task.evidence_items || [])
          .map((item) => item.source_title || item.source_label || "")
          .filter(Boolean),
      )]
    : [];

  if (!manifest.research) manifest.research = {};
  if (!manifest.research.files) manifest.research.files = [];
  if (!manifest.research.selected_sources) manifest.research.selected_sources = [];
  if (!manifest.research.knowledge) {
    manifest.research.knowledge = {
      plan_file: null,
      search_file: null,
      evidence_file: null,
      report_file: null,
      ready: false,
      ready_titles: [],
    };
  }

  const relatedFiles = [
    getArg("--plan"),
    getArg("--search"),
    evidenceArg,
    reportPath,
  ]
    .filter(Boolean)
    .map((filePath) => toManifestPath(baseDir, filePath))
    .filter((item): item is string => Boolean(item));

  manifest.research.files = normalizeExistingFiles(baseDir, [...(manifest.research.files || []), ...relatedFiles]);
  manifest.research.selected_sources = [...new Set([...(manifest.research.selected_sources || []), ...selectedSources])];
  manifest.research.knowledge.plan_file = toManifestPath(baseDir, getArg("--plan"));
  manifest.research.knowledge.search_file = toManifestPath(baseDir, getArg("--search"));
  manifest.research.knowledge.evidence_file = toManifestPath(baseDir, evidenceArg);
  manifest.research.knowledge.report_file = toManifestPath(baseDir, reportPath);
  manifest.research.knowledge.ready = readyTitles.length > 0;
  manifest.research.knowledge.ready_titles = readyTitles;

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    manifest: manifestPath,
    knowledge_ready: manifest.research.knowledge.ready,
    ready_titles: readyTitles,
  }, null, 2));
}

main();
