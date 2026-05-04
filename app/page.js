"use client";

import { useEffect, useState } from "react";
import { clearTask, getTask, setTask } from "@/lib/storage";
import { theme } from "@/lib/theme";

const DEFAULT_MINUTES = 10;
const MAX_MINUTES = 25;

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
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);
  const [autoStartCount, setAutoStartCount] = useState(0);

  useEffect(() => {
    const saved = getTask();
    if (saved) {
      setTaskState(saved);
      setSecondsLeft((saved.currentDuration || DEFAULT_MINUTES) * 60);
    }
  }, []);

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
          setSecondsLeft((task.currentDuration || DEFAULT_MINUTES) * 60);
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
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setShowDonePrompt(false);
    setAutoStartCount(3);
  };

  const startTimer = () => {
    if (secondsLeft === 0) setSecondsLeft(currentMinutes * 60);
    setIsRunning(true);
  };

  const stopEarly = () => {
    if (!task) return;
    const nextTask = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: false }],
      currentDuration: DEFAULT_MINUTES,
    };
    saveTask(nextTask);
    setIsRunning(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setShowDonePrompt(false);
    setAutoStartCount(3);
  };

  const continueSession = () => {
    if (!task) return;
    const nextDuration = Math.min(currentMinutes + 5, MAX_MINUTES);
    const nextTask = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: true }],
      currentDuration: nextDuration,
    };
    saveTask(nextTask);
    setShowDonePrompt(false);
    setSecondsLeft(nextDuration * 60);
    setAutoStartCount(3);
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
    setSecondsLeft(5 * 60);
    setIsRunning(true);
    setAutoStartCount(0);
  };

  const finishTask = () => {
    clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setIsRunning(false);
    setAutoStartCount(0);
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{
        backgroundColor: isRunning ? "#EAF1EC" : theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        {!task ? (
          <>
            <h1 className="text-4xl font-semibold">NeuroPilot</h1>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Your one task"
              className="w-full rounded-xl px-4 py-4 text-2xl"
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
            <p className="text-6xl font-bold">{formatTime(secondsLeft)}</p>

            {showDonePrompt ? (
              <div className="space-y-4">
                <p className="text-3xl font-semibold">Done?</p>
                <button
                  onClick={finishTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Yes
                </button>
                <button
                  onClick={continueSession}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.primary, opacity: 0.85 }}
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {autoStartCount > 0 && !isRunning ? (
                  <p className="text-2xl font-semibold">Starting in {autoStartCount}...</p>
                ) : null}

                <button
                  onClick={isRunning ? stopEarly : startTimer}
                  className="w-full rounded-xl border-2 py-5 text-3xl font-semibold text-white"
                  style={{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }}
                >
                  {isRunning ? "Stop" : "Start Now"}
                </button>

                <button
                  onClick={startDistractionReset}
                  className="text-lg font-medium opacity-80"
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
