import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getPlaces, Place } from "@/lib/places";
import {
  deleteScheduledTask,
  getScheduledTasks,
  type ScheduledTask,
  updateScheduledTask,
} from "@/lib/storage";

const DURATION_PRESETS = [5, 10, 15, 20, 25] as const;

export default function ScheduledScreen() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  const [editing, setEditing] = useState<ScheduledTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState<number>(10);
  const [editPlaceId, setEditPlaceId] = useState<string>("");

  const refresh = async () => {
    const [t, p] = await Promise.all([getScheduledTasks(), getPlaces()]);
    setTasks(t);
    setPlaces(p);
  };

  useEffect(() => {
    refresh();
  }, []);

  const placeName = (id: string): string => {
    const p = places.find((pl) => pl.id === id);
    return p?.name ?? "مكان محذوف";
  };

  const handleLetGo = (id: string) => {
    Alert.alert(
      "تخلّى عنها 🌱",
      "مش كل حاجة لازم تتعمل. تأكيد إنك سايبها؟",
      [
        { text: "لأ", style: "cancel" },
        {
          text: "سايبها",
          style: "destructive",
          onPress: async () => {
            await deleteScheduledTask(id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            refresh();
          },
        },
      ],
    );
  };

  const openEdit = (task: ScheduledTask) => {
    Haptics.selectionAsync();
    setEditing(task);
    setEditTitle(task.title);
    setEditDuration(task.currentDuration);
    setEditPlaceId(task.locationId);
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    const trimmed = editTitle.trim();
    if (!trimmed || !editPlaceId) return;
    await updateScheduledTask(editing.id, {
      title: trimmed,
      currentDuration: editDuration,
      locationId: editPlaceId,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refresh();
    setEditing(null);
  };

  const sorted = tasks.slice().sort((a, b) => a.createdAt - b.createdAt);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.backText}>← رجوع</Text>
        </Pressable>
        <Text style={styles.title}>المهام المجدولة</Text>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            محدش مجدول لسه.{"\n"}ارجع وأضف مهمة مرتبطة بمكان!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.placeLine}>📍 {placeName(item.locationId)}</Text>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.duration}>{item.currentDuration} دقيقة</Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => openEdit(item)}
                  style={({ pressed }) => [
                    styles.editBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.editBtnText}>✏️ تعديل</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleLetGo(item.id)}
                  style={({ pressed }) => [
                    styles.letGoBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.letGoBtnText}>🌱 تخلّى عنها</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Edit modal */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>تعديل المهمة</Text>

            <Text style={styles.fieldLabel}>اسم المهمة</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="اسم المهمة"
              placeholderTextColor="#6B7E80"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>المدة (دقيقة)</Text>
            <View style={styles.durationRow}>
              {DURATION_PRESETS.map((mins) => {
                const active = editDuration === mins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => setEditDuration(mins)}
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

            <Text style={styles.fieldLabel}>المكان</Text>
            <View style={styles.chipsWrap}>
              {places.map((p) => {
                const active = editPlaceId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setEditPlaceId(p.id)}
                    style={({ pressed }) => [
                      styles.placeChip,
                      active && styles.placeChipActive,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.placeChipText,
                        active && styles.placeChipTextActive,
                      ]}
                    >
                      📍 {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={saveEdit}
                disabled={!editTitle.trim() || !editPlaceId}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!editTitle.trim() || !editPlaceId) && styles.saveBtnDisabled,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.saveBtnText}>حفظ</Text>
              </Pressable>
              <Pressable
                onPress={closeEdit}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7F6",
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, color: "#4A6FA5", fontFamily: "Inter_500Medium" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#2E2E2E" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    lineHeight: 26,
  },
  list: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E0E7E3",
  },
  placeLine: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2E6B4A",
    textAlign: "right",
  },
  taskTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "right",
  },
  duration: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    textAlign: "right",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  editBtn: {
    borderWidth: 1,
    borderColor: "#4A6FA5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#4A6FA5",
  },
  letGoBtn: {
    backgroundColor: "#F5F0E8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  letGoBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#8C7B5A",
  },
  // Edit modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "right",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#6B7E80",
    textAlign: "right",
  },
  input: {
    borderWidth: 2,
    borderColor: "#4A6FA5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#2E2E2E",
    textAlign: "right",
  },
  durationRow: { flexDirection: "row", gap: 8 },
  durationBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#4A6FA5",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  durationBtnActive: { backgroundColor: "#4A6FA5" },
  durationBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#4A6FA5",
  },
  durationBtnTextActive: { color: "#fff" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  placeChip: {
    borderWidth: 1.5,
    borderColor: "#4A6FA5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  placeChipActive: { backgroundColor: "#4A6FA5" },
  placeChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#4A6FA5",
  },
  placeChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#4A6FA5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#9BAFD0" },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: { paddingHorizontal: 14, justifyContent: "center" },
  cancelBtnText: {
    color: "#6B7E80",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
