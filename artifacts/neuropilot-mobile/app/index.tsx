import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearTask, getTask, setTask, Task } from "@/lib/storage";

const DEFAULT_MINUTES = 10;
const MAX_MINUTES = 25;

function fmt(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function Home() {
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState("");
  const [task, setTaskState] = useState<Task | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    getTask().then((saved) => {
      if (saved) {
        setTaskState(saved);
        setSecondsLeft((saved.currentDuration ?? DEFAULT_MINUTES) * 60);
      }
    });
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          setShowDonePrompt(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const currentMinutes = task?.currentDuration ?? DEFAULT_MINUTES;

  const save = async (next: Task) => {
    setTaskState(next);
    await setTask(next);
  };

  const addTask = async () => {
    if (!draft.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next: Task = {
      title: draft.trim(),
      sessions: [],
      currentDuration: DEFAULT_MINUTES,
    };
    await save(next);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setDraft("");
    Keyboard.dismiss();
  };

  const startTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (secondsLeft === 0) setSecondsLeft(currentMinutes * 60);
    setIsRunning(true);
  };

  const pauseTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(false);
    setSecondsLeft(currentMinutes * 60);
  };

  const stopEarly = async () => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const next: Task = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: false }],
      currentDuration: DEFAULT_MINUTES,
    };
    await save(next);
    setIsRunning(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  const completeSession = async () => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextDuration = Math.min(currentMinutes + 5, MAX_MINUTES);
    const next: Task = {
      ...task,
      sessions: [...task.sessions, { duration: currentMinutes, completed: true }],
      currentDuration: nextDuration,
    };
    await save(next);
    setShowDonePrompt(false);
    setSecondsLeft(nextDuration * 60);
  };

  const finishTask = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setIsRunning(false);
  };

  const bg = isRunning ? "#EAF1EC" : "#F5F7F6";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View
        style={[
          styles.root,
          { backgroundColor: bg, paddingTop: topPad, paddingBottom: botPad },
        ]}
      >
        {!task ? (
          <View style={styles.center}>
            <Text style={styles.logo} testID="logo">
              NeuroPilot
            </Text>
            <TextInput
              testID="task-input"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addTask}
              placeholder="Your one task"
              placeholderTextColor="#6B7E80"
              returnKeyType="done"
              style={styles.input}
            />
            <Pressable
              testID="add-task-button"
              onPress={addTask}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.btnTextWhite}>Add Task</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.taskTitle} testID="task-title" numberOfLines={2}>
              {task.title}
            </Text>

            <Text style={styles.clock} testID="timer-display">
              {fmt(secondsLeft)}
            </Text>

            {showDonePrompt ? (
              <View style={styles.stack} testID="done-prompt">
                <Text style={styles.doneLabel}>Done?</Text>

                <Pressable
                  testID="finish-task-button"
                  onPress={finishTask}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnAccent,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={styles.btnTextWhite}>Yes</Text>
                </Pressable>

                <Pressable
                  testID="continue-session-button"
                  onPress={completeSession}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutlinePrimary,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.btnTextPrimary}>Continue Next Session</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.stack}>
                {!isRunning ? (
                  <Pressable
                    testID="start-button"
                    onPress={startTimer}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={styles.btnTextWhite}>Start Now</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    testID="pause-button"
                    onPress={pauseTimer}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={styles.btnTextWhite}>Pause</Text>
                  </Pressable>
                )}

                <Pressable
                  testID="reset-button"
                  onPress={resetTimer}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutlinePrimary,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.btnTextPrimary}>Reset</Text>
                </Pressable>

                <Pressable
                  testID="stop-early-button"
                  onPress={stopEarly}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutlineAccent,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.btnTextAccent}>Stop Early</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logo: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#4A6FA5",
    letterSpacing: -1,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    borderWidth: 2,
    borderColor: "#4A6FA5",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: "#2E2E2E",
    backgroundColor: "#fff",
  },
  taskTitle: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    color: "#2E2E2E",
    textAlign: "center",
    marginBottom: 4,
  },
  clock: {
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    letterSpacing: -2,
  },
  doneLabel: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "center",
    marginBottom: 4,
  },
  stack: {
    width: "100%",
    gap: 12,
    alignItems: "center",
  },
  btn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  btnPrimary: {
    backgroundColor: "#4A6FA5",
  },
  btnAccent: {
    backgroundColor: "#7FB069",
  },
  btnOutlinePrimary: {
    borderWidth: 2,
    borderColor: "#4A6FA5",
    backgroundColor: "transparent",
  },
  btnOutlineAccent: {
    borderWidth: 2,
    borderColor: "#7FB069",
    backgroundColor: "transparent",
  },
  btnTextWhite: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  btnTextPrimary: {
    color: "#4A6FA5",
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
  btnTextAccent: {
    color: "#7FB069",
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
});
