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
