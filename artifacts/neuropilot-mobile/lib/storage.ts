import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-task";

export interface Session {
  duration: number;
  completed: boolean;
}

export interface Task {
  title: string;
  sessions: Session[];
  currentDuration: number;
  locationId?: string;
}

export async function getTask(): Promise<Task | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export async function setTask(task: Task): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(task));
  } catch {}
}

export async function clearTask(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
