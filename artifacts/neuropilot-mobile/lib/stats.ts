// Completion tracker for mobile. ADHD brains run on dopamine; visible
// counts and streaks turn invisible effort into a reward signal.
// Mirrors artifacts/neuropilot/src/lib/stats.ts but uses AsyncStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-stats";

function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DailyMap = Record<string, number>;

async function readAll(): Promise<DailyMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
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

async function writeAll(map: DailyMap): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export async function recordCompletedSession(): Promise<void> {
  const map = await readAll();
  const today = isoDate();
  map[today] = (map[today] ?? 0) + 1;
  await writeAll(map);
}

export async function getTodayCount(): Promise<number> {
  const map = await readAll();
  return map[isoDate()] ?? 0;
}

/** Consecutive days (counting today) with at least one completed session. */
export async function getStreak(): Promise<number> {
  const map = await readAll();
  let streak = 0;
  const cursor = new Date();
  while ((map[isoDate(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
