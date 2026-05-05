import { useEffect, useMemo, useState } from "react";
import { clearTask, getTask, setTask, Task } from "@/lib/storage";
import { theme } from "@/lib/theme";

const DEFAULT_MINUTES = 3;
const MAX_MINUTES = 25;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  const [taskTitle, setTaskTitle] = useState("");
  const [nextTaskTitle, setNextTaskTitle] = useState("");
  const [duration, setDuration] = useState(3);
  const [task, setTaskState] = useState<Task | null>(null);
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

  const saveTask = (nextTask: Task) => {
    setTaskState(nextTask);
    setTask(nextTask);
  };

  const createTask = (title: string): Task => ({
    title: title.trim(),
    sessions: [],
    currentDuration: duration,
  });

  const addTask = () => {
    if (!taskTitle.trim()) return;
    const nextTask = createTask(taskTitle);
    saveTask(nextTask);
    setTaskTitle("");
    setSecondsLeft(duration * 60);
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
    setDuration(3);
    setNextTaskTitle("");
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  const switchTask = () => {
    finishTask();
  };

  const startNextTask = () => {
    if (!nextTaskTitle.trim()) return;
    const nextTask = createTask(nextTaskTitle);
    saveTask(nextTask);
    setNextTaskTitle("");
    setShowDonePrompt(false);
    setSecondsLeft(duration * 60);
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
            <button
              onClick={startTimer}
              className="w-full rounded-xl py-5 text-3xl font-semibold text-white"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Start
            </button>
          </>
        )}
      </div>
    </main>
  );
}
