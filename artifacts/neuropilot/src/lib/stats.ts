// Lightweight completion tracker. ADHD brains run on dopamine; visible
// daily counts and streaks turn invisible effort into a reward signal.
//
// Storage shape: { "2026-05-11": 3, "2026-05-10": 1 } keyed by local date.

const KEY = "neuropilot-stats";

function isoDate(d: Date = new Date()): string {
  // YYYY-MM-DD in local time so a session completed at 11pm doesn't roll
  // into "tomorrow" the way toISOString() would.
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DailyMap = Record<string, number>;

function readAll(): DailyMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: DailyMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: DailyMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function recordCompletedSession(): void {
  const map = readAll();
  const today = isoDate();
  map[today] = (map[today] ?? 0) + 1;
  writeAll(map);
}

export function getTodayCount(): number {
  return readAll()[isoDate()] ?? 0;
}

/** Consecutive days (counting today) with at least one completed session. */
export function getStreak(): number {
  const map = readAll();
  let streak = 0;
  const cursor = new Date();
  // Walk back day by day until we hit a zero/missing day.
  while ((map[isoDate(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
