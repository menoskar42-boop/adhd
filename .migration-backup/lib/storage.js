const KEY = "neuropilot-task";

export function getTask() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTask(task) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(task));
}

export function clearTask() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
