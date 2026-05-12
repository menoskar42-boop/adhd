// Frequency tracker for task titles. Surfaces the user's recurring
// chores as one-tap chips on the welcome screen so they don't retype
// the same thing every day. Mirrors the web counterpart on AsyncStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-task-templates";
const MAX_STORED = 30;

interface TemplateEntry {
  title: string;
  count: number;
  lastUsed: number;
}

async function readAll(): Promise<TemplateEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is TemplateEntry =>
        e &&
        typeof e.title === "string" &&
        typeof e.count === "number" &&
        typeof e.lastUsed === "number",
    );
  } catch {
    return [];
  }
}

async function writeAll(list: TemplateEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Track that the user just used this title. Increments its count or
 * adds it as a new entry. Capped at MAX_STORED entries by
 * least-recently-used eviction.
 */
export async function recordTaskTitle(title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const list = await readAll();
  const idx = list.findIndex((e) => e.title === trimmed);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      count: list[idx].count + 1,
      lastUsed: Date.now(),
    };
  } else {
    list.push({ title: trimmed, count: 1, lastUsed: Date.now() });
  }
  if (list.length > MAX_STORED) {
    list.sort((a, b) => b.lastUsed - a.lastUsed);
    list.length = MAX_STORED;
  }
  await writeAll(list);
}

/** Top N titles sorted by count, ties broken by most recently used. */
export async function getTopTemplates(limit = 5): Promise<string[]> {
  const list = await readAll();
  return list
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, limit)
    .map((e) => e.title);
}
