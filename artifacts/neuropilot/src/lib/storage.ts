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
   * Optional "why now" the user set on the no-task screen. Surfaced as
   * a small line under the task title to re-anchor the ADHD prefrontal
   * cortex during the session.
   */
  intention?: string;
  /**
   * Number of consecutive "كمّل دقيقة تانية" presses on this task.
   * Drives a Fibonacci escalation (3 → 5 → 8 → 13 → 21) so each "one
   * more" stretch is longer than the last, rewarding sustained flow.
   * Reset when the user manually bumps duration or finishes the task.
   */
  continueCount?: number;
}

export function getTask(): Task | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export function setTask(task: Task): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(task));
}

export function clearTask(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

function readTaskFrom(key: string): Task | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export function getPendingTask(): Task | null {
  return readTaskFrom(PENDING_KEY);
}

export function setPendingTask(task: Task): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(task));
}

export function clearPendingTask(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_KEY);
}

export function getNextTask(): Task | null {
  return readTaskFrom(NEXT_KEY);
}

export function setNextTask(task: Task): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEXT_KEY, JSON.stringify(task));
}

export function clearNextTask(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NEXT_KEY);
}

// ---------- Scheduled tasks (multiple, location-linked) ----------

export interface ScheduledTask {
  id: string;
  title: string;
  currentDuration: number;
  locationId: string;
  createdAt: number;
}

function writeScheduledTasks(list: ScheduledTask[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULED_KEY, JSON.stringify(list));
}

export function getScheduledTasks(): ScheduledTask[] {
  if (typeof window === "undefined") return [];

  // One-time migration: hoist any legacy singleton pendingTask into the
  // new list so users with prior installs don't lose their scheduled
  // task. Only runs while the list is unset and the legacy key holds
  // a location-linked task.
  if (window.localStorage.getItem(SCHEDULED_KEY) === null) {
    const legacy = getPendingTask();
    if (legacy && legacy.locationId) {
      writeScheduledTasks([
        {
          id: Date.now().toString(),
          title: legacy.title,
          currentDuration: legacy.currentDuration,
          locationId: legacy.locationId,
          createdAt: Date.now(),
        },
      ]);
      clearPendingTask();
    } else {
      writeScheduledTasks([]);
    }
  }

  const raw = window.localStorage.getItem(SCHEDULED_KEY);
  if (!raw) return [];
  try {
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

export function addScheduledTask(task: ScheduledTask): void {
  writeScheduledTasks([...getScheduledTasks(), task]);
}

export function updateScheduledTask(
  id: string,
  patch: Partial<Omit<ScheduledTask, "id" | "createdAt">>,
): void {
  writeScheduledTasks(
    getScheduledTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

export function deleteScheduledTask(id: string): void {
  writeScheduledTasks(getScheduledTasks().filter((t) => t.id !== id));
}
