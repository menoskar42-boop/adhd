"use client";

import { useEffect, useState } from "react";
import { clearTask, getTask, setTask } from "@/lib/storage";
import { theme } from "@/lib/theme";

const DEFAULT_MINUTES = 10;
const MAX_MINUTES = 25;
const DISTRACTION_MINUTES = 5;

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
  const [startCountdown, setStartCountdown] = useState(0);

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

  const createTask = (title) => ({
    title: title.trim(),
    sessions: [],
    currentDuration: DEFAULT_MINUTES,
  });

  const addTask = () => {
    if (!taskTitle.trim()) return;
    const nextTask = createTask(taskTitle);
    saveTask(nextTask);
    setTaskTitle("");
    setShowDonePrompt(false);
    setStartCountdown(3);
  };

  const startTimer = () => {
    if (secondsLeft === 0) setSecondsLeft(currentMinutes * 60);
    setIsRunning(true);
  };

  const pauseTimer = () => setIsRunning(false);

  const finishTask = () => {
    clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setIsRunning(false);
    setStartCountdown(0);
    setSecondsLeft(DEFAULT_MINUTES * 60);
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
  };

  const distractedNow = () => {
    if (!task) return;
    const nextTask = {
      ...task,
      currentDuration: DISTRACTION_MINUTES,
    };
    saveTask(nextTask);
    setShowDonePrompt(false);
    setSecondsLeft(DISTRACTION_MINUTES * 60);
    setIsRunning(true);
  };

  useEffect(() => {
    if (!task || startCountdown <= 0) return;
    const id = setTimeout(() => {
      setStartCountdown((prev) => {
        if (prev <= 1) {
          setSecondsLeft((task.currentDuration || DEFAULT_MINUTES) * 60);
          setIsRunning(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(id);
  }, [task, startCountdown]);

  const completeSession = () => {
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
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{
        backgroundColor: isRunning ? "#EAF1EC" : theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div className="w-full max-w-md text-center space-y-8">
        {!task ? (
          <>
            <h1 className="text-5xl font-semibold">NeuroPilot</h1>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Your one task"
              className="w-full rounded-xl px-6 py-5 text-3xl"
              style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
            />
            <button
              onClick={addTask}
              className="w-full rounded-xl py-5 text-3xl font-semibold text-white"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Add Task
            </button>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-semibold">{task.title}</h1>
            {startCountdown > 0 ? (
              <p className="text-5xl font-bold">
                Starting in {startCountdown}...
              </p>
            ) : (
              <p className="text-7xl font-bold">{formatTime(secondsLeft)}</p>
            )}

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
                  onClick={completeSession}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
                >
                  Continue
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
                  onClick={stopEarly}
                  className="w-full rounded-xl py-4 text-2xl font-semibold"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
                >
                  Stop Early
                </button>

                <button
                  onClick={distractedNow}
                  className="w-full rounded-xl py-3 text-lg font-semibold"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
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
