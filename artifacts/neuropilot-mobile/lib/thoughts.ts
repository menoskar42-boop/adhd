// Brain-dump store for mobile. Mirrors artifacts/neuropilot/src/lib/thoughts.ts
// but uses AsyncStorage instead of localStorage. Lets the user park
// intrusive thoughts mid-session without breaking flow.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-thoughts";

export interface Thought {
  id: string;
  text: string;
  createdAt: number;
}

async function writeAll(list: Thought[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export async function getThoughts(): Promise<Thought[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
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

export async function addThought(text: string): Promise<Thought | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const entry: Thought = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: trimmed,
    createdAt: Date.now(),
  };
  const list = await getThoughts();
  await writeAll([...list, entry]);
  return entry;
}

export async function deleteThought(id: string): Promise<void> {
  const list = await getThoughts();
  await writeAll(list.filter((t) => t.id !== id));
}

export async function clearAllThoughts(): Promise<void> {
  await writeAll([]);
}
