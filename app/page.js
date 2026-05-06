"use client";

import { useEffect, useRef, useState } from "react";
import { clearTask, getTask, setTask } from "@/lib/storage";
import { theme } from "@/lib/theme";

const DEFAULT_MINUTES = 10;
const STOP_EARLY_RESET_MINUTES = 3;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "local-build";

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  const [taskTitle, setTaskTitle] = useState("");
  const [task, setTaskState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);
  const [autoStartCount, setAutoStartCount] = useState(0);
  const reminderTimeoutsRef = useRef([]);
  const isRunningRef = useRef(false);

  const clearReminderTimeouts = () => {
    reminderTimeoutsRef.current.forEach((id) => clearTimeout(id));
    reminderTimeoutsRef.current = [];
  };

  const sendGentleReminder = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification("بس 3 دقايق ونبدأ");
  };

  const scheduleReminders = () => {
    clearReminderTimeouts();
    const reminderDelays = [2, 7, 17];
    reminderTimeoutsRef.current = reminderDelays.map((delayMinutes) =>
      setTimeout(() => {
        if (!isRunningRef.current) {
          sendGentleReminder();
        }
      }, delayMinutes * 60 * 1000)
    );
  };

  useEffect(() => {
    const saved = getTask();
    if (saved) {
      setTaskState(saved);
      setTimeLeft((saved.currentDuration || DEFAULT_MINUTES) * 60);
    }
  }, []);

  useEffect(() => () => clearReminderTimeouts(), []);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
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

  const currentMinutes = task?.currentDuration || DEFAULT_MINUTES;

  const saveTask = (nextTask) => {
    setTaskState(nextTask);
    setTask(nextTask);
  };

  useEffect(() => {
    if (!task || showDonePrompt) return;
    if (isRunning) return;
    if (autoStartCount <= 0) return;

    const id = setTimeout(() => {
      setAutoStartCount((prev) => {
        if (prev <= 1) {
          setTimeLeft((task.currentDuration || DEFAULT_MINUTES) * 60);
          setIsRunning(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(id);
  }, [autoStartCount, isRunning, showDonePrompt, task]);

  const addTask = () => {
    if (!taskTitle.trim()) return;
    const nextTask = {
      title: taskTitle.trim(),
      sessions: [],
      currentDuration: DEFAULT_MINUTES,
    };
    saveTask(nextTask);
    setTaskTitle("");
    setTimeLeft(DEFAULT_MINUTES * 60);
    setShowDonePrompt(false);
    setAutoStartCount(2);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    scheduleReminders();
  };


  const startTimer = () => {
    setIsRunning(true);
    clearReminderTimeouts();
  };

  const pauseTimer = () => setIsRunning(false);

  const stopEarly = () => {
    if (!task) return;
    const nextTask = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: false }],
      currentDuration: STOP_EARLY_RESET_MINUTES,
    };
    saveTask(nextTask);
    setIsRunning(false);
    setTimeLeft(STOP_EARLY_RESET_MINUTES * 60);
    setShowDonePrompt(false);
    setAutoStartCount(0);
  };

  const nextSession = () => {
    if (!task) return;
    const nextTask = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: true }],
    };
    saveTask(nextTask);
    setShowDonePrompt(false);
    setTimeLeft((task.currentDuration || DEFAULT_MINUTES) * 60);
    setIsRunning(true);
    setAutoStartCount(0);
  };

  const startDistractionReset = () => {
    if (!task) return;
    const nextTask = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: false }],
      currentDuration: DEFAULT_MINUTES,
    };
    saveTask(nextTask);
    setShowDonePrompt(false);
    setTimeLeft(5 * 60);
    setIsRunning(true);
    setAutoStartCount(0);
  };

  const finishTask = () => {
    clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setTimeLeft(DEFAULT_MINUTES * 60);
    setIsRunning(false);
    setAutoStartCount(0);
    clearReminderTimeouts();
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{
        backgroundColor: "#EAF1EC",
        color: theme.colors.text,
      }}
    >
      <div className="w-full max-w-md text-center space-y-10">
        <p className="text-xs opacity-60">Build: {APP_VERSION}</p>
        {!task ? (
          <>
            <h1 className="text-5xl font-semibold">NeuroPilot</h1>
            <p className="text-xl opacity-75">نبدأ 3 دقايق بس</p>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Your one task"
              className="w-full rounded-xl px-6 py-5 text-3xl text-center"
            />
            <button
              onClick={addTask}
              className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Add Task
            </button>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-semibold">{task.title}</h1>
            <p className="text-6xl font-bold">{formatTime(timeLeft)}</p>

            {showDonePrompt ? (
              <div className="space-y-4">
                <p className="text-5xl font-semibold">Done?</p>
                <button
                  onClick={finishTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Yes
                </button>
                <button
                  onClick={nextSession}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {autoStartCount > 0 && !isRunning ? (
                  <p className="text-3xl font-semibold">Starting in {autoStartCount}...</p>
                ) : null}

                <div className="space-y-4">
                  {!isRunning ? (
                    <button
                      onClick={startTimer}
                      className="w-full rounded-xl border-2 py-6 text-4xl font-semibold text-white"
                      style={{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }}
                    >
                      Start
                    </button>
                  ) : null}

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={pauseTimer}
                      disabled={!isRunning}
                      className="rounded-xl border-2 py-4 text-xl font-semibold"
                      style={{
                        borderColor: theme.colors.primary,
                        color: isRunning ? theme.colors.primary : "#94A3B8",
                        opacity: isRunning ? 1 : 0.5,
                      }}
                    >
                      Pause
                    </button>
                    <button
                      onClick={stopEarly}
                      className="rounded-xl border-2 py-4 text-xl font-semibold"
                      style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
                    >
                      Stop
                    </button>
                    <button
                      onClick={nextSession}
                      className="rounded-xl border-2 py-4 text-xl font-semibold"
                      style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <button
                  onClick={startDistractionReset}
                  className="text-2xl font-medium"
                >
                  I'm distracted
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
