// Brain-dump store: lets the user park intrusive thoughts during a focus
// session without breaking flow. Everything sits in localStorage, sync
// API, so capture is instant.

const KEY = "neuropilot-thoughts";

export interface Thought {
  id: string;
  text: string;
  createdAt: number;
}

function writeAll(list: Thought[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function getThoughts(): Thought[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is Thought =>
        t &&
        typeof t.id === "string" &&
        typeof t.text === "string" &&
        typeof t.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function addThought(text: string): Thought | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const entry: Thought = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: trimmed,
    createdAt: Date.now(),
  };
  writeAll([...getThoughts(), entry]);
  return entry;
}

export function deleteThought(id: string): void {
  writeAll(getThoughts().filter((t) => t.id !== id));
}

export function clearAllThoughts(): void {
  writeAll([]);
}
