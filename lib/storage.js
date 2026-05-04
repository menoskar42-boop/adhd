const KEY = "neuropilot-task";

export function getTask() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      currentDuration:
        typeof parsed.currentDuration === "number" && parsed.currentDuration >= 10
          ? Math.min(parsed.currentDuration, 25)
          : 10,
    };
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
