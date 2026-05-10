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
