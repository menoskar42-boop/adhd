import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { clearTask, getTask, setTask, Task } from "@/lib/storage";
import { getPlaceById, getPlaces, type Place } from "@/lib/places";
import {
  requestPermissions as requestGeofencePermissions,
  startGeofence,
  stopGeofence,
} from "@/lib/geofence";
import { theme } from "@/lib/theme";
import { useWakeLock } from "@/hooks/use-wake-lock";

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

  // Keep screen awake while a task is loaded (browser wake lock).
  useWakeLock(task !== null);

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

  // On mount: load saved task + show gentle open message if one exists.
  // If the saved task is linked to a place, re-arm the foreground geofence
  // since watchPosition does not persist across page loads.
  useEffect(() => {
    const saved = getTask();
    if (saved) {
      setTaskState(saved);
      setSecondsLeft((saved.currentDuration || DEFAULT_MINUTES) * 60);
      setShowOpenMessage(true);
      if (saved.locationId) {
        const place = getPlaceById(saved.locationId);
        if (place) startGeofence(place.latitude, place.longitude);
      }
      const t = setTimeout(() => setShowOpenMessage(false), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

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

  const armGeofenceFor = async (placeId: string | null) => {
    if (!placeId) return;
    const place = getPlaceById(placeId);
    if (!place) return;
    const granted = await requestGeofencePermissions();
    if (granted) {
      startGeofence(place.latitude, place.longitude);
    } else {
      window.alert(
        "محتاج تفعّل تصريح الموقع والإشعارات علشان يشتغل التنبيه عند الوصول.",
      );
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await requestPermission();
    const nextTask = createTask(taskTitle, selectedPlaceId);
    saveTask(nextTask);
    setTaskTitle("");
    setSecondsLeft(duration * 60);
    scheduleReminders();
    await armGeofenceFor(selectedPlaceId);
    setSelectedPlaceId(null);
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
    setTaskState(null);
    setShowDonePrompt(false);
    setShowOpenMessage(false);
    setIsRunning(false);
    setDuration(DEFAULT_MINUTES);
    setNextTaskTitle("");
    setSecondsLeft(DEFAULT_MINUTES * 60);
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

      <div className="w-full max-w-md text-center space-y-6">
        {!task ? (
          <>
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
          </>
        ) : (
          <>
            <h1 className="text-4xl font-semibold">{task.title}</h1>
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
            <p className="text-6xl font-bold">{formatTime(secondsLeft)}</p>

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
                  onClick={resetTimer}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ border: `2px solid ${theme.colors.primary}` }}
                >
                  Reset
                </button>

                <button
                  onClick={stopEarly}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ border: `2px solid ${theme.colors.accent}` }}
                >
                  Stop Early
                </button>

                <button
                  onClick={switchTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ border: `2px dashed ${theme.colors.text}` }}
                >
                  Change Task
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
