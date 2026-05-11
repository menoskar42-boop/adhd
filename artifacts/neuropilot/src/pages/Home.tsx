import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  addScheduledTask,
  clearNextTask,
  clearTask,
  getNextTask,
  getScheduledTasks,
  getTask,
  type ScheduledTask,
  setTask,
  Task,
} from "@/lib/storage";
import { getPlaceById, getPlaces, type Place } from "@/lib/places";
import { addThought } from "@/lib/thoughts";
import {
  getStreak,
  getTodayCount,
  recordCompletedSession,
} from "@/lib/stats";
import {
  type GeofenceTarget,
  onArrival,
  requestPermissions as requestGeofencePermissions,
  setGeofenceTargets,
  stopGeofence,
} from "@/lib/geofence";
import { theme } from "@/lib/theme";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_MINUTES = 3;
const MAX_MINUTES = 25;
const REMINDER_MSG = "بس 3 دقايق ونبدأ";
const OPEN_MSG = "نبدأ 3 دقايق بس";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function notify(body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("NeuroPilot", { body });
  }
}

async function requestPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export default function Home() {
  const [taskTitle, setTaskTitle] = useState("");
  const [nextTaskTitle, setNextTaskTitle] = useState("");
  const [duration, setDuration] = useState(DEFAULT_MINUTES);
  const [task, setTaskState] = useState<Task | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);
  const [showOpenMessage, setShowOpenMessage] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [nextTaskState, setNextTaskState] = useState<Task | null>(null);
  const [permissionDialog, setPermissionDialog] = useState<{
    task: Task;
    place: Place;
  } | null>(null);
  const { toast } = useToast();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [brainDumpText, setBrainDumpText] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // Refresh the wall clock every 15s so end-of-session estimates stay
  // accurate without thrashing renders.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const wallClock = useMemo(() => {
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }, [now]);

  const endTime = useMemo(() => {
    if (!task) return null;
    const end = new Date(Date.now() + secondsLeft * 1000);
    const h = end.getHours().toString().padStart(2, "0");
    const m = end.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }, [task, secondsLeft]);

  const progressPct = useMemo(() => {
    const total = (task?.currentDuration ?? DEFAULT_MINUTES) * 60;
    if (total <= 0) return 0;
    const elapsed = total - secondsLeft;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }, [task, secondsLeft]);
  const [todayCount, setTodayCount] = useState<number>(() => getTodayCount());
  const [streak, setStreak] = useState<number>(() => getStreak());

  const saveThought = () => {
    const saved = addThought(brainDumpText);
    if (!saved) return;
    setBrainDumpText("");
    setBrainDumpOpen(false);
    toast({ description: "تم حفظ الفكرة 💭 — كمّل مهمتك." });
  };

  // Keep screen awake while a task is running or any scheduled task is
  // waiting on arrival (so the foreground geofence keeps polling).
  useWakeLock(task !== null || scheduledTasks.length > 0);

  const [, navigate] = useLocation();

  // Reload saved places whenever we land on the no-task screen
  // (e.g., after returning from /places).
  useEffect(() => {
    if (!task) setPlaces(getPlaces());
  }, [task]);

  const reminderTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearReminders = () => {
    reminderTimers.current.forEach(clearTimeout);
    reminderTimers.current = [];
  };

  const scheduleReminders = () => {
    clearReminders();
    // 2 min → 7 min (2+5) → 17 min (2+5+10)
    const delays = [2 * 60 * 1000, 7 * 60 * 1000, 17 * 60 * 1000];
    delays.forEach((ms) => {
      reminderTimers.current.push(setTimeout(() => notify(REMINDER_MSG), ms));
    });
  };

  // Build the geofence target list from the unique places referenced by
  // any currently scheduled task. Returns an empty array if no place is
  // resolvable. Memoised so the arming effect below only re-runs when the
  // schedule actually changes.
  const geofenceTargets = useMemo<GeofenceTarget[]>(() => {
    const seen = new Set<string>();
    const list: GeofenceTarget[] = [];
    for (const t of scheduledTasks) {
      if (seen.has(t.locationId)) continue;
      const place = getPlaceById(t.locationId);
      if (!place) continue;
      seen.add(t.locationId);
      list.push({
        placeId: place.id,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    }
    return list;
  }, [scheduledTasks]);

  // On mount: load active + scheduled + next task.
  useEffect(() => {
    const saved = getTask();
    const scheduled = getScheduledTasks();
    const next = getNextTask();

    if (saved) {
      setTaskState(saved);
      setSecondsLeft((saved.currentDuration || DEFAULT_MINUTES) * 60);
      setShowOpenMessage(true);
    }
    setScheduledTasks(scheduled);
    if (next) setNextTaskState(next);

    const t = saved
      ? setTimeout(() => setShowOpenMessage(false), 4000)
      : null;
    return () => {
      if (t) clearTimeout(t);
    };
  }, []);

  // Re-arm the foreground watcher every time the set of scheduled places
  // changes. An empty list stops the watcher entirely.
  useEffect(() => {
    setGeofenceTargets(geofenceTargets);
    return () => {
      // Don't stop on unmount — the arrival callback persists with the
      // page, and re-mounts will replace the target list anyway.
    };
  }, [geofenceTargets]);

  // Refresh task state from storage whenever the geofence fires arrival.
  useEffect(() => {
    return onArrival(() => {
      setTaskState(getTask());
      setScheduledTasks(getScheduledTasks());
      setNextTaskState(getNextTask());
      const active = getTask();
      if (active && !isRunning) {
        setSecondsLeft((active.currentDuration || DEFAULT_MINUTES) * 60);
      }
    });
  }, [isRunning]);

  // Cleanup reminders on unmount
  useEffect(() => () => clearReminders(), []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsRunning(false);
          setShowDonePrompt(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning]);

  const currentMinutes = useMemo(
    () => task?.currentDuration || DEFAULT_MINUTES,
    [task]
  );

  const saveTask = (nextTask: Task) => {
    setTaskState(nextTask);
    setTask(nextTask);
  };

  const linkedPlace = useMemo(
    () => (task?.locationId ? getPlaceById(task.locationId) : null),
    [task]
  );

  const createTask = (title: string, placeId?: string | null): Task => ({
    title: title.trim(),
    sessions: [],
    currentDuration: duration,
    locationId: placeId ?? undefined,
  });

  // Requests location + notification permission and starts the foreground
  // watcher for the given place. Returns true on success.
  // Request browser geofence permissions. The watcher itself is managed
  // by the effect that mirrors scheduledTasks to setGeofenceTargets, so
  // we just need a yes/no here. The `place` argument is unused now but
  // kept on the signature so call sites stay symmetric.
  const armGeofenceFor = async (_place: Place): Promise<boolean> => {
    void _place;
    return await requestGeofencePermissions();
  };

  // Append a location-linked task to the scheduled list and confirm with
  // a toast. The geofence target list is re-armed by the effect that
  // watches scheduledTasks.
  const scheduleTask = (taskToSchedule: Task) => {
    if (!taskToSchedule.locationId) return;
    const entry: ScheduledTask = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: taskToSchedule.title,
      currentDuration: taskToSchedule.currentDuration,
      locationId: taskToSchedule.locationId,
      createdAt: Date.now(),
    };
    addScheduledTask(entry);
    setScheduledTasks((prev) => [...prev, entry]);
    setTaskTitle("");
    setSelectedPlaceId(null);
    toast({
      description: "تمت إضافة المهمة إلى المهام المجدولة 📋",
    });
  };

  // Activate a task immediately, stripping any locationId (used when the
  // user starts a location-linked task as a normal one after permission
  // denial).
  const activateImmediately = (taskToActivate: Task) => {
    const stripped: Task = { ...taskToActivate, locationId: undefined };
    saveTask(stripped);
    setTaskTitle("");
    setSelectedPlaceId(null);
    setSecondsLeft(duration * 60);
    scheduleReminders();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const candidate = createTask(taskTitle, selectedPlaceId);

    if (selectedPlaceId) {
      const place = getPlaceById(selectedPlaceId);
      if (!place) {
        // Place vanished between selection and add — fall back to normal.
        activateImmediately(candidate);
        return;
      }
      const armed = await armGeofenceFor(place);
      if (armed) {
        scheduleTask(candidate);
      } else {
        // Open the modal asking the user how to proceed.
        setPermissionDialog({ task: candidate, place });
      }
      return;
    }

    // No place linked — keep the existing immediate-start behaviour.
    activateImmediately(candidate);
    await requestPermission();
  };

  // Permission dialog actions.
  const dialogStartAsNormal = () => {
    if (!permissionDialog) return;
    activateImmediately(permissionDialog.task);
    setPermissionDialog(null);
  };

  const dialogRequestPermission = async () => {
    if (!permissionDialog) return;
    const armed = await armGeofenceFor(permissionDialog.place);
    if (armed) {
      scheduleTask(permissionDialog.task);
      setPermissionDialog(null);
    }
    // Otherwise, leave the dialog open so the user can retry or cancel.
  };

  const dialogCancel = () => {
    setPermissionDialog(null);
  };

  const startTimer = () => {
    clearReminders();
    setShowOpenMessage(false);
    if (secondsLeft === 0) setSecondsLeft(currentMinutes * 60);
    setIsRunning(true);
  };

  const pauseTimer = () => setIsRunning(false);

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(currentMinutes * 60);
  };

  const finishTask = () => {
    clearReminders();
    stopGeofence();
    clearTask();
    clearNextTask();
    setTaskState(null);
    setNextTaskState(null);
    setShowDonePrompt(false);
    setShowOpenMessage(false);
    setIsRunning(false);
    setDuration(DEFAULT_MINUTES);
    setNextTaskTitle("");
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  // Promote the queued next task to active (used when the user arrives
  // at a place while already working on something else and decides to
  // switch).
  const activateNextTask = () => {
    const activating = nextTaskState;
    if (!activating) return;
    clearReminders();
    stopGeofence();
    clearTask();
    clearNextTask();
    setNextTaskState(null);
    setIsRunning(false);
    setShowDonePrompt(false);
    setTaskState(activating);
    setTask(activating);
    setSecondsLeft((activating.currentDuration || DEFAULT_MINUTES) * 60);
    scheduleReminders();
    // The watcher is driven by scheduledTasks; the activated task isn't
    // in that list, so no re-arm is needed here. The user is presumably
    // already at the place anyway.
  };

  const dismissNextTask = () => {
    clearNextTask();
    setNextTaskState(null);
  };

  const switchTask = () => finishTask();

  const startNextTask = async () => {
    if (!nextTaskTitle.trim()) return;
    await requestPermission();
    const nextTask = createTask(nextTaskTitle);
    saveTask(nextTask);
    setNextTaskTitle("");
    setShowDonePrompt(false);
    setSecondsLeft(duration * 60);
    scheduleReminders();
  };

  const stopEarly = () => {
    if (!task) return;
    const nextTask: Task = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: false }],
      currentDuration: DEFAULT_MINUTES,
    };
    saveTask(nextTask);
    setIsRunning(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  // Forgiving recovery: notice the distraction, shrink to a 5-minute
  // warm-up window, and start immediately. Deliberately does NOT push a
  // "failed" session onto the task — ADHD users need guilt-free re-entry.
  const DISTRACTION_MINUTES = 5;
  const markDistracted = () => {
    if (!task) return;
    const nextTask: Task = { ...task, currentDuration: DISTRACTION_MINUTES };
    saveTask(nextTask);
    setSecondsLeft(DISTRACTION_MINUTES * 60);
    setShowDonePrompt(false);
    setIsRunning(true);
    clearReminders();
    toast({ description: "ولا يهمك — 5 دقايق بس ونرجع." });
  };

  const completeSession = () => {
    if (!task) return;
    const nextDuration = Math.min(currentMinutes + 5, MAX_MINUTES);
    const nextTask: Task = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: true }],
      currentDuration: nextDuration,
    };
    saveTask(nextTask);
    setShowDonePrompt(false);
    setSecondsLeft(nextDuration * 60);
    // Dopamine moment: record the completion and trigger the celebration
    // overlay. Refresh streak/today so the welcome screen reflects it.
    recordCompletedSession();
    setTodayCount(getTodayCount());
    setStreak(getStreak());
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2200);
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{
        backgroundColor: isRunning ? "#EAF1EC" : theme.colors.background,
        color: theme.colors.text,
      }}
    >
      {/* Gentle open message */}
      {showOpenMessage && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-xl font-semibold shadow-sm transition-opacity duration-500"
          style={{
            backgroundColor: theme.colors.primary,
            color: "#fff",
            direction: "rtl",
          }}
        >
          {OPEN_MSG}
        </div>
      )}

      {/* Bottom sheet for the secondary timer actions. ADHD-friendly:
          one primary action in view, everything else hidden behind a
          deliberate tap. Reset and Change Task confirm before firing. */}
      {moreMenuOpen && task && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={() => setMoreMenuOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 space-y-3"
            style={{ direction: "rtl" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (!window.confirm("تعيد التايمر من الأول؟")) return;
                resetTimer();
                setMoreMenuOpen(false);
              }}
              className="w-full rounded-xl py-3 text-lg font-semibold border-2"
              style={{
                borderColor: theme.colors.primary,
                color: theme.colors.primary,
              }}
            >
              إعادة التايمر
            </button>
            <button
              onClick={() => {
                stopEarly();
                setMoreMenuOpen(false);
              }}
              className="w-full rounded-xl py-3 text-lg font-semibold border-2"
              style={{
                borderColor: theme.colors.accent,
                color: theme.colors.accent,
              }}
            >
              وقف الجلسة بدرى
            </button>
            <button
              onClick={() => {
                if (!window.confirm("تخلّى المهمة الحالية؟")) return;
                switchTask();
                setMoreMenuOpen(false);
              }}
              className="w-full rounded-xl py-3 text-lg font-semibold"
              style={{
                border: `2px dashed ${theme.colors.text}`,
                color: theme.colors.text,
              }}
            >
              غيّر المهمة
            </button>
            <button
              onClick={() => setMoreMenuOpen(false)}
              className="w-full rounded-xl py-2 text-base font-medium"
              style={{ color: "#6B7E80" }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Celebration overlay — fires after a completed session as a
          dopamine reward. Pointer-events-none so it never blocks taps. */}
      {celebrate && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          aria-live="polite"
        >
          <div
            className="px-8 py-6 rounded-3xl shadow-2xl celebrate-pop"
            style={{
              backgroundColor: theme.colors.accent,
              color: "#fff",
              direction: "rtl",
            }}
          >
            <p className="text-5xl text-center">🎉</p>
            <p className="text-2xl font-bold mt-2 text-center">أحسنت!</p>
            <p className="text-sm mt-1 text-center opacity-90">
              جلسة {todayCount} النهارده {streak >= 2 ? `· 🔥 ${streak} أيام` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Quick brain-dump capture — keeps the user's focus while parking
          intrusive thoughts. */}
      {brainDumpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl"
            style={{ direction: "rtl" }}
          >
            <h2
              className="text-xl font-bold"
              style={{ color: theme.colors.text }}
            >
              💭 فكرة سريعة
            </h2>
            <p className="text-sm" style={{ color: "#6B7E80" }}>
              اكتب الفكرة وارجع لمهمتك. هتلاقيها بعدين فى صفحة "أفكارى".
            </p>
            <textarea
              value={brainDumpText}
              onChange={(e) => setBrainDumpText(e.target.value)}
              placeholder="مثلاً: لازم أبعت إيميل لـ..."
              rows={3}
              autoFocus
              className="w-full rounded-xl border-2 px-3 py-2 text-base outline-none resize-none bg-white"
              style={{
                borderColor: theme.colors.primary,
                textAlign: "right",
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={saveThought}
                disabled={!brainDumpText.trim()}
                className="flex-1 rounded-xl py-3 text-base font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: theme.colors.primary }}
              >
                احفظ ورجّعنى للمهمة
              </button>
              <button
                onClick={() => {
                  setBrainDumpText("");
                  setBrainDumpOpen(false);
                }}
                className="rounded-xl px-4 py-3 text-base font-medium"
                style={{ color: "#6B7E80" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission-denied dialog for location-linked tasks. */}
      {permissionDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl"
            style={{ direction: "rtl" }}
          >
            <h2
              className="text-2xl font-bold"
              style={{ color: theme.colors.text }}
            >
              تنبيه الموقع مش مفعّل
            </h2>
            <p className="text-base leading-7" style={{ color: "#4A5654" }}>
              مش هينفع نسجّل المهمة كمهمة مجدولة لأن تصريح الموقع مش متاح.
              عاوز تبدأها كمهمة عادية ولا تدّى الإذن وتفضل مجدولة؟
            </p>
            <div className="space-y-3 pt-1">
              <button
                onClick={dialogStartAsNormal}
                className="w-full rounded-xl py-3 text-lg font-semibold text-white"
                style={{ backgroundColor: theme.colors.primary }}
              >
                ابدأ الآن
              </button>
              <button
                onClick={dialogRequestPermission}
                className="w-full rounded-xl py-3 text-lg font-semibold border-2"
                style={{
                  borderColor: theme.colors.primary,
                  color: theme.colors.primary,
                  backgroundColor: "transparent",
                }}
              >
                إعطاء الإذن للموقع
              </button>
              <button
                onClick={dialogCancel}
                className="w-full rounded-xl py-3 text-base font-medium"
                style={{ color: "#6B7E80" }}
              >
                إلغاء المهمة
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md text-center space-y-6">
        {!task ? (
          <>
            {(todayCount > 0 || streak > 0) && (
              <div
                className="inline-flex items-center gap-2 self-center rounded-full px-3 py-1 text-sm font-medium"
                style={{
                  backgroundColor: "#E8F0EC",
                  color: "#2E6B4A",
                  direction: "rtl",
                }}
              >
                {streak >= 2 && <span>🔥 {streak} أيام</span>}
                {streak >= 2 && todayCount > 0 && <span>·</span>}
                {todayCount > 0 && <span>اليوم {todayCount} جلسة</span>}
              </div>
            )}
            <div className="relative flex items-center justify-center w-full">
              <h1 className="text-4xl font-semibold">NeuroPilot</h1>
              <button
                onClick={() => navigate("/places")}
                aria-label="Saved places"
                className="absolute right-0 p-1.5 text-2xl hover:opacity-70 transition-opacity"
              >
                📍
              </button>
            </div>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Your one task"
              className="w-full rounded-xl border-2 px-4 py-4 text-2xl outline-none"
              style={{ borderColor: theme.colors.primary }}
            />
            {places.length > 0 && (
              <div className="w-full space-y-2" style={{ direction: "rtl" }}>
                <p className="text-sm font-medium" style={{ color: "#6B7E80" }}>
                  تنبيه عند وصولك لـ:
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {places.map((place) => {
                    const active = selectedPlaceId === place.id;
                    return (
                      <button
                        key={place.id}
                        onClick={() =>
                          setSelectedPlaceId(active ? null : place.id)
                        }
                        className="shrink-0 rounded-full border-2 px-3.5 py-2 text-sm font-medium transition-colors"
                        style={{
                          borderColor: theme.colors.primary,
                          backgroundColor: active
                            ? theme.colors.primary
                            : "transparent",
                          color: active ? "#fff" : theme.colors.primary,
                        }}
                      >
                        📍 {place.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              onClick={addTask}
              className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Start Now
            </button>
            {scheduledTasks.length > 0 && (
              <button
                onClick={() => navigate("/scheduled")}
                className="text-base font-medium underline-offset-4 hover:underline"
                style={{ color: theme.colors.primary, direction: "rtl" }}
              >
                📋 المهام المجدولة ({scheduledTasks.length})
              </button>
            )}
            <button
              onClick={() => navigate("/thoughts")}
              className="text-sm font-medium underline-offset-4 hover:underline"
              style={{ color: "#6B7E80", direction: "rtl" }}
            >
              💭 أفكارى
            </button>
          </>
        ) : (
          <>
            {nextTaskState && (
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{
                  backgroundColor: "#E8F0EC",
                  borderColor: theme.colors.accent,
                  borderWidth: 1,
                  direction: "rtl",
                }}
              >
                <p
                  className="text-base font-medium"
                  style={{ color: "#2E6B4A" }}
                >
                  📍 وصلت! مهمتك الجاية جاهزة:{" "}
                  <span className="font-bold">{nextTaskState.title}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={activateNextTask}
                    className="flex-1 rounded-lg py-2 text-base font-semibold text-white"
                    style={{ backgroundColor: theme.colors.accent }}
                  >
                    ابدأها دلوقتى
                  </button>
                  <button
                    onClick={dismissNextTask}
                    className="rounded-lg px-4 py-2 text-base font-medium"
                    style={{
                      color: "#6B7E80",
                      borderColor: "#A0AFAA",
                      borderWidth: 1,
                    }}
                  >
                    احذفها
                  </button>
                </div>
              </div>
            )}
            <p
              className="text-sm font-medium tabular-nums"
              style={{ color: "#6B7E80" }}
            >
              🕐 {wallClock}
            </p>
            <div className="relative flex items-center justify-center w-full">
              <h1 className="text-4xl font-semibold">{task.title}</h1>
              <button
                onClick={() => setBrainDumpOpen(true)}
                aria-label="سجّل فكرة"
                className="absolute right-0 p-1.5 text-2xl hover:opacity-70 transition-opacity"
              >
                💭
              </button>
            </div>
            {linkedPlace && (
              <div
                className="inline-block rounded-xl px-3.5 py-2 text-sm font-medium"
                style={{
                  backgroundColor: "#E8F0EC",
                  color: "#2E6B4A",
                  direction: "rtl",
                }}
              >
                📍 تنبيه عند وصولك: {linkedPlace.name}
              </div>
            )}
            <p className="text-6xl font-bold tabular-nums">
              {formatTime(secondsLeft)}
            </p>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "#E0E7E3" }}
              aria-hidden="true"
            >
              <div
                className="h-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: theme.colors.primary,
                }}
              />
            </div>
            {endTime && (
              <p
                className="text-sm font-medium tabular-nums"
                style={{ color: "#6B7E80", direction: "rtl" }}
              >
                ينتهى الساعة {endTime}
              </p>
            )}

            {showDonePrompt ? (
              <div className="space-y-4">
                <p className="text-3xl font-semibold">Done?</p>
                <button
                  onClick={completeSession}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ border: `2px solid ${theme.colors.primary}` }}
                >
                  Continue Next Session
                </button>
                <button
                  onClick={finishTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ border: `2px solid ${theme.colors.accent}` }}
                >
                  Finish Task
                </button>
                <input
                  value={nextTaskTitle}
                  onChange={(e) => setNextTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && startNextTask()}
                  placeholder="Next task"
                  className="w-full rounded-xl border-2 px-4 py-4 text-xl outline-none"
                  style={{ borderColor: theme.colors.primary }}
                />
                <button
                  onClick={startNextTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  Start Next Task
                </button>
                <button
                  onClick={switchTask}
                  className="w-full rounded-xl py-4 text-xl font-semibold"
                  style={{ border: `2px dashed ${theme.colors.text}` }}
                >
                  Change Task Manually
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {!isRunning ? (
                  <button
                    onClick={startTimer}
                    className="w-full rounded-xl py-5 text-3xl font-semibold text-white"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Start Now
                  </button>
                ) : (
                  <button
                    onClick={pauseTimer}
                    className="w-full rounded-xl py-5 text-3xl font-semibold text-white"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Pause
                  </button>
                )}

                <button
                  onClick={markDistracted}
                  className="w-full rounded-xl py-3 text-base font-medium"
                  style={{
                    border: `2px solid ${theme.colors.accent}`,
                    color: theme.colors.accent,
                    direction: "rtl",
                  }}
                >
                  🌀 شارد ذهنياً — رجّعنى بـ 5 دقايق
                </button>

                <button
                  onClick={() => setMoreMenuOpen(true)}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                  style={{ color: "#6B7E80", direction: "rtl" }}
                >
                  ⋮ المزيد
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
