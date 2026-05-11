const KEY = "neuropilot-places";

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export function getPlaces(): Place[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Place =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.latitude === "number" &&
        typeof p.longitude === "number",
    );
  } catch {
    return [];
  }
}

export function savePlace(place: Place): void {
  if (typeof window === "undefined") return;
  const next = [...getPlaces(), place];
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function deletePlace(id: string): void {
  if (typeof window === "undefined") return;
  const next = getPlaces().filter((p) => p.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function getPlaceById(id: string): Place | null {
  return getPlaces().find((p) => p.id === id) ?? null;
}
