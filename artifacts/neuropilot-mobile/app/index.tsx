import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
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

import { isGeofenceActive, requestPermissions, startGeofence, stopGeofence } from "@/lib/geofence";
import { getPlaces, Place } from "@/lib/places";
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

  // Places
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showChangePlaceModal, setShowChangePlaceModal] = useState(false);
  const [geofenceActive, setGeofenceActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const loadPlaces = useCallback(async () => {
    setPlaces(await getPlaces());
  }, []);

  useEffect(() => {
    getTask().then((saved) => {
      if (saved) {
        setTaskState(saved);
        setSecondsLeft((saved.currentDuration ?? DEFAULT_MINUTES) * 60);
      }
    });
    loadPlaces();
    isGeofenceActive().then(setGeofenceActive);
  }, [loadPlaces]);

  // Reload places whenever this screen is focused (e.g., returning from Places modal)
  useFocusEffect(
    useCallback(() => {
      loadPlaces();
    }, [loadPlaces])
  );

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
      locationId: selectedPlaceId ?? undefined,
    };
    await save(next);
    setSecondsLeft(DEFAULT_MINUTES * 60);
    setDraft("");
    Keyboard.dismiss();

    // Register geofence if a place was selected
    if (selectedPlaceId) {
      const place = places.find((p) => p.id === selectedPlaceId);
      if (place) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            "تنبيه الموقع",
            `عشان نبعتلك تنبيه لما توصل "${place.name}"، التطبيق محتاج:\n\n• تصريح الإشعارات\n• تصريح الموقع "دايماً" (مش بس وانت شغّال التطبيق)\n\nدلوقتي هتظهرلك رسايل من الجهاز عشان توافق.`,
            [
              {
                text: "تمام، وافق",
                onPress: async () => {
                  const granted = await requestPermissions();
                  if (!granted) {
                    Alert.alert(
                      "تصريح مش مكتمل",
                      "محتاج تفعّل الموقع على 'دايماً' في إعدادات التطبيق عشان يشتغل التنبيه."
                    );
                  } else {
                    await startGeofence(place.latitude, place.longitude);
                  }
                  setGeofenceActive(await isGeofenceActive());
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
        const granted = await requestPermissions();
        if (granted) {
          await startGeofence(place.latitude, place.longitude);
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
                      </Pressable>
                    );
                  })}
                </ScrollView>
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
          </View>
        ) : (
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
                {places.length > 1 && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowChangePlaceModal(true);
                    }}
                    style={({ pressed }) => [
                      styles.changePlaceBtn,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    testID="change-place-button"
                  >
                    <Text style={styles.changePlaceBtnText}>غيّر المكان</Text>
                  </Pressable>
                )}
              </View>
            )}

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
  chip: {
    borderWidth: 1.5,
    borderColor: "#4A6FA5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
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
  changePlaceBtn: {
    borderTopWidth: 1,
    borderTopColor: "#D4ECCC",
    backgroundColor: "#F4FBF2",
    paddingVertical: 10,
    alignItems: "center",
  },
  changePlaceBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#7FB069",
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
});
