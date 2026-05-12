import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "neuropilot-task";
const PENDING_KEY = "neuropilot-pending-task";
const NEXT_KEY = "neuropilot-next-task";
const SCHEDULED_KEY = "neuropilot-scheduled-tasks";

export interface Session {
  duration: number;
  completed: boolean;
}

export interface Task {
  title: string;
  sessions: Session[];
  currentDuration: number;
  locationId?: string;
  /**
   * Optional "why now" the user set before starting. Surfaced as a
   * small line under the task title to re-anchor the ADHD prefrontal
   * cortex during the session.
   */
  intention?: string;
}

export interface ScheduledTask {
  id: string;
  title: string;
  currentDuration: number;
  locationId: string;
  createdAt: number;
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

// ---------- Scheduled tasks (multiple, location-linked) ----------

async function writeScheduledTasks(list: ScheduledTask[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(list));
  } catch {}
}

export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  try {
    // One-time migration: if the new key is unset and the legacy
    // singleton pendingTask has a locationId, hoist it into the list.
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (raw === null) {
      const legacy = await getPendingTask();
      if (legacy && legacy.locationId) {
        await writeScheduledTasks([
          {
            id: Date.now().toString(),
            title: legacy.title,
            currentDuration: legacy.currentDuration,
            locationId: legacy.locationId,
            createdAt: Date.now(),
          },
        ]);
        await clearPendingTask();
      } else {
        await writeScheduledTasks([]);
      }
      const fresh = await AsyncStorage.getItem(SCHEDULED_KEY);
      if (!fresh) return [];
      const parsed = JSON.parse(fresh);
      return Array.isArray(parsed) ? (parsed as ScheduledTask[]) : [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ScheduledTask =>
        t &&
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.currentDuration === "number" &&
        typeof t.locationId === "string" &&
        typeof t.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export async function addScheduledTask(task: ScheduledTask): Promise<void> {
  const list = await getScheduledTasks();
  await writeScheduledTasks([...list, task]);
}

export async function updateScheduledTask(
  id: string,
  patch: Partial<Omit<ScheduledTask, "id" | "createdAt">>,
): Promise<void> {
  const list = await getScheduledTasks();
  await writeScheduledTasks(
    list.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

export async function deleteScheduledTask(id: string): Promise<void> {
  const list = await getScheduledTasks();
  await writeScheduledTasks(list.filter((t) => t.id !== id));
}
