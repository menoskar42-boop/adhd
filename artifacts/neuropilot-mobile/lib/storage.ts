import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-task";
const PENDING_KEY = "neuropilot-pending-task";
const NEXT_KEY = "neuropilot-next-task";

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

export async function getPendingTask(): Promise<Task | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export async function setPendingTask(task: Task): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(task));
  } catch {}
}

export async function clearPendingTask(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
}

export async function getNextTask(): Promise<Task | null> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export async function setNextTask(task: Task): Promise<void> {
  try {
    await AsyncStorage.setItem(NEXT_KEY, JSON.stringify(task));
  } catch {}
}

export async function clearNextTask(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NEXT_KEY);
  } catch {}
}
