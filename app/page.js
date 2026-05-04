"use client";

import { useEffect, useMemo, useState } from "react";
import { clearTask, getTask, setTask } from "@/lib/storage";
import { theme } from "@/lib/theme";

const DEFAULT_MINUTES = 10;
const MAX_MINUTES = 25;
const MIN_MINUTES = 5;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDuration, setTaskDuration] = useState(DEFAULT_MINUTES);
  const [task, setTaskState] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);

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

  const currentMinutes = useMemo(
    () => task?.currentDuration || DEFAULT_MINUTES,
    [task]
  );

  const saveTask = (nextTask) => {
    setTaskState(nextTask);
    setTask(nextTask);
  };

  const addTask = () => {
    if (!taskTitle.trim()) return;
    const nextTask = {
      title: taskTitle.trim(),
      sessions: [],
      currentDuration: taskDuration,
    };
    saveTask(nextTask);
    setTaskTitle("");
    setSecondsLeft(taskDuration * 60);
  };

  const startTimer = () => {
    if (secondsLeft === 0) setSecondsLeft(currentMinutes * 60);
    setIsRunning(true);
  };

  const pauseTimer = () => setIsRunning(false);

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(currentMinutes * 60);
  };


  const finishTask = () => {
    clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setIsRunning(false);
    setTaskDuration(DEFAULT_MINUTES);
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  const switchTask = () => {
    finishTask();
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
      <div className="w-full max-w-md text-center space-y-6">
        {!task ? (
          <>
            <h1 className="text-4xl font-semibold">NeuroPilot</h1>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Your one task"
              className="w-full rounded-xl border-2 px-4 py-4 text-2xl"
              style={{ borderColor: theme.colors.primary }}
            />
            <label className="block text-left text-lg font-semibold">
              Session length (minutes)
              <input
                type="range"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={5}
                value={taskDuration}
                onChange={(e) => setTaskDuration(Number(e.target.value))}
                className="mt-3 w-full"
              />
            </label>
            <p className="text-xl font-semibold">{taskDuration} min</p>
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
                <button
                  onClick={switchTask}
                  className="w-full rounded-xl py-4 text-2xl font-semibold text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  Start Another Task
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
