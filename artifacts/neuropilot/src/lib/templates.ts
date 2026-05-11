// Tiny frequency tracker for task titles. ADHD users repeat the same
// chores ("اشترى طلبات", "ذاكر شوية", "اغسل المواعين") often and
// retyping every time is friction. The most-used titles surface as
// one-tap chips on the welcome screen.

const KEY = "neuropilot-task-templates";
const MAX_STORED = 30;

interface TemplateEntry {
  title: string;
  count: number;
  lastUsed: number;
}

function readAll(): TemplateEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
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

function writeAll(list: TemplateEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * Track that the user just used this title. Increments its count or
 * adds it as a new entry. The list is capped at MAX_STORED entries
 * by least-recently-used eviction so it doesn't grow forever.
 */
export function recordTaskTitle(title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  const list = readAll();
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
  // Evict by last-used time once we exceed the cap.
  if (list.length > MAX_STORED) {
    list.sort((a, b) => b.lastUsed - a.lastUsed);
    list.length = MAX_STORED;
  }
  writeAll(list);
}

/** Top N titles sorted by count, ties broken by most recently used. */
export function getTopTemplates(limit = 5): string[] {
  return readAll()
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, limit)
    .map((e) => e.title);
}
