import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type GeofenceTarget,
  isExpoGo,
  isGeofenceActive,
  PermissionDeniedReason,
  requestPermissions,
  setGeofenceTargets,
  startGeofence,
  stopGeofence,
} from "@/lib/geofence";
import { getPlaces, Place } from "@/lib/places";
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

function permissionDeniedAlert(reason: PermissionDeniedReason | null): { title: string; message: string } {
  if (reason === "notifications") {
    return {
      title: "الإشعارات مش مفعّلة",
      message: "عشان يوصلك تنبيه لما توصل المكان، افتح الإعدادات وفعّل الإشعارات للتطبيق.",
    };
  }
  return {
    title: "تصريح الموقع مش مكتمل",
    message: "عشان يشتغل تنبيه الموقع، افتح الإعدادات وغيّر صلاحية الموقع لـ «دايماً».",
  };
}

const DEFAULT_MINUTES = 10;
const MAX_MINUTES = 25;
const DURATION_PRESETS = [5, 10, 15, 20, 25] as const;
const POLL_INTERVAL_MS = 2000;

function fmt(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function Home() {
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_MINUTES);
  const [task, setTaskState] = useState<Task | null>(null);
  const [scheduledTasks, setScheduledTasksState] = useState<ScheduledTask[]>([]);
  const [nextTask, setNextTaskState] = useState<Task | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showDonePrompt, setShowDonePrompt] = useState(false);

  // Places
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showChangePlaceModal, setShowChangePlaceModal] = useState(false);
  const [geofenceActive, setGeofenceActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const loadPlaces = useCallback(async () => {
    setPlaces(await getPlaces());
  }, []);

  // Read all storage state at once. getScheduledTasks() also runs the
  // legacy pendingTask migration on its first call.
  const refreshState = useCallback(async () => {
    const [saved, scheduled, next, gfActive] = await Promise.all([
      getTask(),
      getScheduledTasks(),
      getNextTask(),
      isGeofenceActive(),
    ]);
    setTaskState((prev) => {
      if (!prev && saved) {
        setSecondsLeft((saved.currentDuration ?? DEFAULT_MINUTES) * 60);
      }
      return saved;
    });
    setScheduledTasksState(scheduled);
    setNextTaskState(next);
    setGeofenceActive(gfActive);
  }, []);

  useEffect(() => {
    refreshState();
    loadPlaces();

    // Poll to pick up background geofence state changes
    pollRef.current = setInterval(refreshState, POLL_INTERVAL_MS);

    // Also refresh when app comes back to foreground
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        refreshState();
        loadPlaces();
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, [refreshState, loadPlaces]);

  // Reload places whenever this screen is focused (e.g., returning from Places modal)
  useFocusEffect(
    useCallback(() => {
      loadPlaces();
      refreshState();
    }, [loadPlaces, refreshState])
  );

  // Mirror the scheduled-tasks list to the native geofence: one target
  // per unique linked place. An empty list stops the watcher entirely.
  useEffect(() => {
    if (isExpoGo()) return;
    const seen = new Set<string>();
    const targets: GeofenceTarget[] = [];
    for (const t of scheduledTasks) {
      if (seen.has(t.locationId)) continue;
      const place = places.find((p) => p.id === t.locationId);
      if (!place) continue;
      seen.add(t.locationId);
      targets.push({
        placeId: place.id,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    }
    setGeofenceTargets(targets).then(async () => {
      setGeofenceActive(await isGeofenceActive());
    });
  }, [scheduledTasks, places]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      deactivateKeepAwake();
      return;
    }
    activateKeepAwakeAsync();
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
      deactivateKeepAwake();
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

    const newTask: Task = {
      title: draft.trim(),
      sessions: [],
      currentDuration: duration,
      locationId: selectedPlaceId ?? undefined,
    };

    setDraft("");
    Keyboard.dismiss();

    if (selectedPlaceId) {
      // Location-linked task → save as pending and wait for arrival
      const place = places.find((p) => p.id === selectedPlaceId);
      if (place) {
        // Expo Go does not support geofencing — inform the user and skip the flow
        if (isExpoGo()) {
          Alert.alert(
            "تنبيه الموقع مش متاح",
            "تنبيهات الموقع بتحتاج نسخة التطوير (Dev Build) ومش بتشتغل في Expo Go.\n\nهتتضاف المهمة بدون تنبيه موقع."
          );
          await save({ ...newTask, locationId: undefined });
          setSecondsLeft(duration * 60);
        } else {
          await new Promise<void>((resolve) => {
            Alert.alert(
              "تنبيه الموقع",
              `عشان نبعتلك تنبيه لما توصل "${place.name}"، التطبيق محتاج:\n\n• تصريح الإشعارات\n• تصريح الموقع "دايماً" (مش بس وانت شغّال التطبيق)\n\nدلوقتي هتظهرلك رسايل من الجهاز عشان توافق.`,
              [
                {
                  text: "تمام، وافق",
                  onPress: async () => {
                    try {
                      const { granted, reason } = await requestPermissions();
                      if (!granted) {
                        // Permission denied — save as active task without geofence so work isn't lost
                        const taskWithoutLocation: Task = { ...newTask, locationId: undefined };
                        await save(taskWithoutLocation);
                        setSecondsLeft(duration * 60);
                        const { title, message } = permissionDeniedAlert(reason);
                        Alert.alert(
                          title,
                          `اتضافت المهمة بدون تنبيه موقع. ${message}`,
                          [
                            { text: "مش دلوقتي", style: "cancel" },
                            {
                              text: "افتح الإعدادات",
                              onPress: () => Linking.openSettings(),
                            },
                          ]
                        );
                      } else {
                        // Add to the scheduled list; the targets effect
                        // re-arms the native geofence to include it.
                        const entry: ScheduledTask = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          title: newTask.title,
                          currentDuration: newTask.currentDuration,
                          locationId: place.id,
                          createdAt: Date.now(),
                        };
                        await addScheduledTask(entry);
                        setScheduledTasksState((prev) => [...prev, entry]);
                      }
                    } catch {
                      // Unexpected native error — save task without geofence so work isn't lost
                      await save({ ...newTask, locationId: undefined });
                      setSecondsLeft(duration * 60);
                      Alert.alert(
                        "خطأ غير متوقع",
                        "حصل مشكلة في تفعيل تنبيه الموقع. اتضافت المهمة بدون تنبيه موقع."
                      );
                    }
                    resolve();
                  },
                },
                {
                  text: "مش دلوقتي",
                  style: "cancel",
                  onPress: () => resolve(),
                },
              ]
            );
          });
        }
      }
    } else {
      // No location — activate immediately as usual
      await save(newTask);
      setSecondsLeft(duration * 60);
    }

    setSelectedPlaceId(null);
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
    await stopGeofence();
    await clearTask();
    setTaskState(null);
    setShowDonePrompt(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setIsRunning(false);
    setGeofenceActive(false);
  };

  // Activate the queued next task, replacing the current one
  const activateNextTask = async () => {
    if (!nextTask) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopGeofence();
    await clearTask();
    await clearNextTask();

    const activating = nextTask;
    setNextTaskState(null);
    setIsRunning(false);
    setShowDonePrompt(false);

    await setTask(activating);
    setTaskState(activating);
    setSecondsLeft((activating.currentDuration ?? DEFAULT_MINUTES) * 60);

    // If the next task has a location, restart the geofence for it (dev build only)
    if (activating.locationId && !isExpoGo()) {
      const place = places.find((p) => p.id === activating.locationId);
      if (place) {
        await startGeofence(place.latitude, place.longitude);
        setGeofenceActive(await isGeofenceActive());
      }
    }
  };

  const changeTask = () => {
    Alert.alert(
      "غيّر المهمة",
      "هتمسح المهمة الحالية وتبدأ من الأول. متأكد؟",
      [
        { text: "لأ", style: "cancel" },
        {
          text: "آه، غيّر",
          style: "destructive",
          onPress: finishTask,
        },
      ]
    );
  };

  const changePlace = async (newPlaceId: string | null) => {
    if (!task) return;
    Haptics.selectionAsync();
    setShowChangePlaceModal(false);

    await stopGeofence();

    const next: Task = { ...task, locationId: newPlaceId ?? undefined };
    await save(next);

    if (newPlaceId) {
      const place = places.find((p) => p.id === newPlaceId);
      if (place) {
        if (isExpoGo()) {
          Alert.alert(
            "تنبيه الموقع مش متاح",
            "تنبيهات الموقع بتحتاج نسخة التطوير (Dev Build) ومش بتشتغل في Expo Go."
          );
        } else {
          try {
            const { granted, reason } = await requestPermissions();
            if (granted) {
              await startGeofence(place.latitude, place.longitude);
            } else {
              const { title, message } = permissionDeniedAlert(reason);
              Alert.alert(
                title,
                message,
                [
                  { text: "مش دلوقتي", style: "cancel" },
                  {
                    text: "افتح الإعدادات",
                    onPress: () => Linking.openSettings(),
                  },
                ]
              );
            }
          } catch {
            Alert.alert(
              "خطأ غير متوقع",
              "حصل مشكلة في تفعيل تنبيه الموقع."
            );
          }
        }
      }
    }

    setGeofenceActive(await isGeofenceActive());
  };

  const bg = isRunning ? "#EAF1EC" : "#F5F7F6";

  // Which place is linked to the active task
  const linkedPlace = task?.locationId
    ? places.find((p) => p.id === task.locationId)
    : null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View
        style={[
          styles.root,
          { backgroundColor: bg, paddingTop: topPad, paddingBottom: botPad },
        ]}
      >
        {!task ? (
          /* ── EMPTY STATE: no task yet ── */
          <View style={styles.center}>
            {/* Header row: logo + places button */}
            <View style={styles.headerRow}>
              <Text style={styles.logo} testID="logo">
                NeuroPilot
              </Text>
              <Pressable
                onPress={() => router.push("/places")}
                style={({ pressed }) => [
                  styles.placesIconBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                testID="places-button"
              >
                <Text style={styles.placesIcon}>📍</Text>
              </Pressable>
            </View>

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

            {/* Duration presets */}
            <View style={styles.durationWrapper}>
              <Text style={styles.durationLabel}>مدة الجلسة (دقيقة):</Text>
              <View style={styles.durationRow}>
                {DURATION_PRESETS.map((mins) => {
                  const active = duration === mins;
                  return (
                    <Pressable
                      key={mins}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setDuration(mins);
                      }}
                      style={({ pressed }) => [
                        styles.durationBtn,
                        active && styles.durationBtnActive,
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          active && styles.durationBtnTextActive,
                        ]}
                      >
                        {mins}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Place chips */}
            {places.length > 0 && (
              <View style={styles.chipsWrapper}>
                <Text style={styles.chipsLabel}>تنبيه عند وصولك لـ:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {places.map((place) => {
                    const active = selectedPlaceId === place.id;
                    return (
                      <Pressable
                        key={place.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedPlaceId(active ? null : place.id);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          { opacity: pressed ? 0.75 : 1 },
                        ]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          📍 {place.name}
                        </Text>
                        {active && (
                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedPlaceId(null);
                            }}
                            hitSlop={8}
                            style={styles.chipClear}
                          >
                            <Text style={styles.chipClearText}>✕</Text>
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {selectedPlaceId && (
                  <Text style={styles.placePermissionHint}>
                    يتطلب صلاحية الموقع «دائمًا» والإشعارات
                  </Text>
                )}
              </View>
            )}

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

            {scheduledTasks.length > 0 && (
              <Pressable
                onPress={() => router.push("/scheduled")}
                style={({ pressed }) => [
                  styles.linkRow,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.linkText}>
                  📋 المهام المجدولة ({scheduledTasks.length})
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push("/thoughts")}
              style={({ pressed }) => [
                styles.linkRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.linkTextMuted}>💭 أفكارى</Text>
            </Pressable>
          </View>

        ) : (
          /* ── ACTIVE TASK STATE ── */
          <View style={styles.center}>
            <Text style={styles.taskTitle} testID="task-title" numberOfLines={2}>
              {task.title}
            </Text>

            {/* Location map-pin card */}
            {linkedPlace && (
              <View style={styles.mapPinCard}>
                <View style={styles.mapPinCardInner}>
                  <View style={styles.mapPinIconWrap}>
                    <Text style={styles.mapPinEmoji}>📍</Text>
                  </View>
                  <View style={styles.mapPinInfo}>
                    <View style={styles.mapPinRow}>
                      <Text style={styles.mapPinName} numberOfLines={1}>
                        {linkedPlace.name}
                      </Text>
                      {geofenceActive && (
                        <View style={styles.geofenceBadge}>
                          <View style={styles.geofenceDot} />
                          <Text style={styles.geofenceBadgeText}>نشط</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.mapPinCoords}>
                      {linkedPlace.latitude.toFixed(4)}°{linkedPlace.latitude >= 0 ? "N" : "S"},{" "}
                      {linkedPlace.longitude.toFixed(4)}°{linkedPlace.longitude >= 0 ? "E" : "W"}
                    </Text>
                    <Text style={styles.mapPinSub}>تنبيه عند وصولك لهذا المكان</Text>
                  </View>
                </View>
                <View style={styles.mapPinActions}>
                  {places.length > 1 && (
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowChangePlaceModal(true);
                      }}
                      style={({ pressed }) => [
                        styles.changePlaceBtn,
                        styles.changePlaceBtnLeft,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      testID="change-place-button"
                    >
                      <Text style={styles.changePlaceBtnText}>غيّر المكان</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      changePlace(null);
                    }}
                    style={({ pressed }) => [
                      styles.changePlaceBtn,
                      styles.removePlaceBtn,
                      places.length > 1 && styles.removePlaceBtnBorder,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    testID="remove-place-button"
                  >
                    <Text style={styles.removePlaceBtnText}>✕  إزالة المكان</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.clock} testID="timer-display">
              {fmt(secondsLeft)}
            </Text>

            {/* Next task banner */}
            {nextTask && (
              <Pressable
                testID="next-task-button"
                onPress={activateNextTask}
                style={({ pressed }) => [
                  styles.nextTaskBanner,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={styles.nextTaskInner}>
                  <View style={styles.nextTaskDot} />
                  <View style={styles.nextTaskText}>
                    <Text style={styles.nextTaskLabel}>المهمة التالية</Text>
                    <Text style={styles.nextTaskName} numberOfLines={1}>
                      {nextTask.title}
                    </Text>
                  </View>
                  <Text style={styles.nextTaskArrow}>←</Text>
                </View>
              </Pressable>
            )}

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

                <Pressable
                  testID="change-task-button"
                  onPress={changeTask}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutlineNeutral,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.btnTextNeutral}>غيّر المهمة</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Change Place Modal */}
        <Modal
          visible={showChangePlaceModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowChangePlaceModal(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowChangePlaceModal(false)}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>اختار مكان تاني</Text>
              <Text style={styles.modalSubtitle}>
                هيوقف التنبيه الحالي ويبدأ تنبيه للمكان الجديد
              </Text>
              <ScrollView
                style={styles.modalList}
                showsVerticalScrollIndicator={false}
              >
                {places
                  .filter((p) => p.id !== task?.locationId)
                  .map((place) => (
                    <Pressable
                      key={place.id}
                      onPress={() => changePlace(place.id)}
                      style={({ pressed }) => [
                        styles.modalPlaceRow,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={styles.modalPlacePin}>📍</Text>
                      <View style={styles.modalPlaceInfo}>
                        <Text style={styles.modalPlaceName}>{place.name}</Text>
                        <Text style={styles.modalPlaceCoords}>
                          {place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}°
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                <Pressable
                  onPress={() => changePlace(null)}
                  style={({ pressed }) => [
                    styles.modalRemoveRow,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.modalRemoveText}>✕  إلغاء ربط المكان</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
    marginBottom: 8,
  },
  logo: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#4A6FA5",
    letterSpacing: -1,
  },
  placesIconBtn: {
    position: "absolute",
    right: 0,
    padding: 6,
  },
  placesIcon: {
    fontSize: 26,
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
  chipsWrapper: {
    width: "100%",
    gap: 8,
  },
  chipsLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#6B7E80",
    textAlign: "right",
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  placePermissionHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    textAlign: "right",
    marginTop: 2,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: "#4A6FA5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipActive: {
    backgroundColor: "#4A6FA5",
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#4A6FA5",
  },
  chipTextActive: {
    color: "#fff",
  },
  chipClear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipClearText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
  // Waiting screen
  waitingCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4A6FA5",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  waitingEmoji: {
    fontSize: 48,
  },
  waitingTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "center",
  },
  waitingBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#4A6FA5",
    textAlign: "center",
    lineHeight: 22,
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F4E4",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  waitingBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#2E6B4A",
  },
  // Next task banner
  nextTaskBanner: {
    width: "100%",
    backgroundColor: "#FFF8E6",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F0C040",
    overflow: "hidden",
  },
  nextTaskInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  nextTaskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E6A800",
  },
  nextTaskText: {
    flex: 1,
    gap: 2,
  },
  nextTaskLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#8A6400",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextTaskName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#2E2E2E",
  },
  nextTaskArrow: {
    fontSize: 18,
    color: "#E6A800",
    fontFamily: "Inter_700Bold",
  },
  // Existing styles
  mapPinCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#7FB069",
    overflow: "hidden",
  },
  mapPinCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  mapPinIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#E8F4E4",
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinEmoji: {
    fontSize: 26,
  },
  mapPinInfo: {
    flex: 1,
    gap: 3,
  },
  mapPinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapPinName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#2E2E2E",
  },
  geofenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F4E4",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  geofenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7FB069",
  },
  geofenceBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#2E6B4A",
  },
  mapPinCoords: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
  },
  mapPinSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#4A8C6A",
  },
  mapPinActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#D4ECCC",
  },
  changePlaceBtn: {
    flex: 1,
    backgroundColor: "#F4FBF2",
    paddingVertical: 10,
    alignItems: "center",
  },
  changePlaceBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: "#D4ECCC",
  },
  changePlaceBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#7FB069",
  },
  removePlaceBtn: {
    backgroundColor: "#FFF6F6",
  },
  removePlaceBtnBorder: {
    borderLeftWidth: 0,
  },
  removePlaceBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#C0392B",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0D5D3",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    textAlign: "center",
    marginBottom: 16,
  },
  modalList: {
    flexGrow: 0,
  },
  modalPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F2",
  },
  modalPlacePin: {
    fontSize: 22,
  },
  modalPlaceInfo: {
    flex: 1,
    gap: 2,
  },
  modalPlaceName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#2E2E2E",
  },
  modalPlaceCoords: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
  },
  modalRemoveRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  modalRemoveText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#C0392B",
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
  btnOutlineNeutral: {
    borderWidth: 1.5,
    borderColor: "#A0AFAA",
    backgroundColor: "transparent",
  },
  btnTextNeutral: {
    color: "#6B7E80",
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
  durationWrapper: {
    width: "100%",
    gap: 8,
  },
  durationLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#6B7E80",
    textAlign: "right",
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  durationBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#4A6FA5",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  durationBtnActive: {
    backgroundColor: "#4A6FA5",
  },
  durationBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#4A6FA5",
  },
  durationBtnTextActive: {
    color: "#fff",
  },
  linkRow: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#4A6FA5",
  },
  linkTextMuted: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#6B7E80",
  },
});
