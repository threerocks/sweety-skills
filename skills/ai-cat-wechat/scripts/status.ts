import { ensureAiCatDataDir, loadCatalogs, loadRunHistory, loadTrackState } from "./store.ts";
import type { Slot, Track } from "./types.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeTrack(input?: string): Track | "news" | undefined {
  if (input === "kids" || input === "adult" || input === "portfolio" || input === "news") return input;
  return undefined;
}

function normalizeSlot(input?: string): Slot | undefined {
  if (input === "kids" || input === "adult" || input === "evening" || input === "news") return input;
  return undefined;
}

function main(): void {
  const dataDir = ensureAiCatDataDir(getArg("--data-dir"));
  const track = normalizeTrack(getArg("--track"));
  const slot = normalizeSlot(getArg("--slot"));
  const catalogs = loadCatalogs(dataDir);
  const state = loadTrackState(dataDir);
  const history = loadRunHistory(dataDir);

  const filteredHistory = history
    .filter((entry) => (track ? entry.track === track : true))
    .filter((entry) => (slot ? entry.slot === slot : true))
    .slice(-10)
    .reverse();

  const trackSummary = track && track !== "news"
    ? state.tracks[track]
    : state.tracks;

  console.log(JSON.stringify({
    ok: true,
    data_dir: dataDir,
    track: track || null,
    slot: slot || null,
    track_state: trackSummary,
    validated_catalogs: catalogs.filter((item) => item.status === "validated" && (!track || item.track === track)).map((item) => ({
      track: item.track,
      course_id: item.course_id,
      course_title: item.course_title,
      priority: item.priority,
      item_count: item.catalog_items.length,
      evergreen: item.evergreen || false,
      validated_at: item.validated_at,
    })),
    recent_runs: filteredHistory,
  }, null, 2));
}

main();
