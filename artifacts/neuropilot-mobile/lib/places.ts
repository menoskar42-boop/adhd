import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-places";

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export async function getPlaces(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Place[];
  } catch {
    return [];
  }
}

export async function savePlace(place: Place): Promise<void> {
  try {
    const existing = await getPlaces();
    await AsyncStorage.setItem(KEY, JSON.stringify([...existing, place]));
  } catch {}
}

export async function deletePlace(id: string): Promise<void> {
  try {
    const existing = await getPlaces();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(existing.filter((p) => p.id !== id))
    );
  } catch {}
}
