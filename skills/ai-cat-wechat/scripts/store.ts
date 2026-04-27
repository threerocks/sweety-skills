import fs from "node:fs";
import path from "node:path";
import type {
  CourseCatalog,
  HotCaseHistoryEntry,
  RunHistoryEntry,
  TrackStateFile,
  WatchlistsFile,
} from "./types.ts";
import { resolveAiCatDataDir } from "./config.ts";

const EMPTY_WATCHLISTS: WatchlistsFile = { tracks: { kids: [], adult: [], portfolio: [] } };

const EMPTY_TRACK_STATE: TrackStateFile = {
  tracks: {
    kids: {
      track: "kids",
      current_course_id: null,
      current_item_index: 0,
      completed_course_ids: [],
      status: "idle",
      last_run_at: null,
      last_published_run_id: null,
    },
    adult: {
      track: "adult",
      current_course_id: null,
      current_item_index: 0,
      completed_course_ids: [],
      status: "idle",
      last_run_at: null,
      last_published_run_id: null,
    },
    portfolio: {
      track: "portfolio",
      current_course_id: null,
      current_item_index: 0,
      completed_course_ids: [],
      status: "idle",
      last_run_at: null,
      last_published_run_id: null,
    },
  },
};

function filePath(dataDir: string, filename: string): string {
  return path.join(dataDir, filename);
}

export function ensureAiCatDataDir(explicitDataDir?: string): string {
  const dataDir = resolveAiCatDataDir(explicitDataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function readJson<T>(targetPath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(targetPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function watchlistsPath(dataDir: string): string {
  return filePath(dataDir, "course-watchlists.json");
}

export function catalogsPath(dataDir: string): string {
  return filePath(dataDir, "course-catalogs.json");
}

export function trackStatePath(dataDir: string): string {
  return filePath(dataDir, "track-state.json");
}

export function runHistoryPath(dataDir: string): string {
  return filePath(dataDir, "run-history.json");
}

export function hotCaseHistoryPath(dataDir: string): string {
  return filePath(dataDir, "hot-case-history.json");
}

export function loadWatchlists(dataDir: string): WatchlistsFile {
  return readJson(watchlistsPath(dataDir), EMPTY_WATCHLISTS);
}

export function loadCatalogs(dataDir: string): CourseCatalog[] {
  return readJson(catalogsPath(dataDir), [] as CourseCatalog[]);
}

export function saveCatalogs(dataDir: string, catalogs: CourseCatalog[]): void {
  writeJson(catalogsPath(dataDir), catalogs);
}

export function loadTrackState(dataDir: string): TrackStateFile {
  return readJson(trackStatePath(dataDir), EMPTY_TRACK_STATE);
}

export function saveTrackState(dataDir: string, state: TrackStateFile): void {
  writeJson(trackStatePath(dataDir), state);
}

export function loadRunHistory(dataDir: string): RunHistoryEntry[] {
  return readJson(runHistoryPath(dataDir), [] as RunHistoryEntry[]);
}

export function saveRunHistory(dataDir: string, entries: RunHistoryEntry[]): void {
  writeJson(runHistoryPath(dataDir), entries);
}

export function loadHotCaseHistory(dataDir: string): HotCaseHistoryEntry[] {
  return readJson(hotCaseHistoryPath(dataDir), [] as HotCaseHistoryEntry[]);
}

export function saveHotCaseHistory(dataDir: string, entries: HotCaseHistoryEntry[]): void {
  writeJson(hotCaseHistoryPath(dataDir), entries);
}
