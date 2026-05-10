import { useEffect, useMemo, useRef, useState } from "react";
import { clearTask, getTask, setTask, Task } from "@/lib/storage";
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

  // Keep screen awake while a task is loaded (browser wake lock).
  useWakeLock(task !== null);

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

  // On mount: load saved task + show gentle open message if one exists
  useEffect(() => {
    const saved = getTask();
    if (saved) {
      setTaskState(saved);
      setSecondsLeft((saved.currentDuration || DEFAULT_MINUTES) * 60);
      setShowOpenMessage(true);
      // Hide open message after 4 seconds
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

  const createTask = (title: string): Task => ({
    title: title.trim(),
    sessions: [],
    currentDuration: duration,
  });

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await requestPermission();
    const nextTask = createTask(taskTitle);
    saveTask(nextTask);
    setTaskTitle("");
    setSecondsLeft(duration * 60);
    scheduleReminders();
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
            <h1 className="text-4xl font-semibold">NeuroPilot</h1>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Your one task"
              className="w-full rounded-xl border-2 px-4 py-4 text-2xl outline-none"
              style={{ borderColor: theme.colors.primary }}
            />
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
