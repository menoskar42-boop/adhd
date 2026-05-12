import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  clearAllThoughts,
  deleteThought,
  getThoughts,
  type Thought,
} from "@/lib/thoughts";

export default function ThoughtsScreen() {
  const insets = useSafeAreaInsets();
  const [thoughts, setThoughts] = useState<Thought[]>([]);

  const refresh = async () => {
    setThoughts(await getThoughts());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteThought(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    refresh();
  };

  const handleClearAll = () => {
    Alert.alert("مسح كل الأفكار", "تمسح كل الأفكار المحفوظة؟", [
      { text: "لأ", style: "cancel" },
      {
        text: "امسح الكل",
        style: "destructive",
        onPress: async () => {
          await clearAllThoughts();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          refresh();
        },
      },
    ]);
  };

  const sorted = thoughts.slice().sort((a, b) => b.createdAt - a.createdAt);

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
        <Text style={styles.title}>💭 أفكارى</Text>
        {sorted.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [
              styles.clearBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.clearText}>مسح الكل</Text>
          </Pressable>
        )}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            مفيش أفكار محفوظة لسه.{"\n"}
            لما تكون فى مهمة وفكرة تيجى فى دماغك، اضغط 💭 وسجّلها هنا.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardText}>{item.text}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTime}>
                  {new Date(item.createdAt).toLocaleString("ar-EG", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Text>
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={styles.deleteText}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
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
  clearBtn: { marginLeft: "auto", paddingVertical: 4 },
  clearText: { fontSize: 14, color: "#C0392B", fontFamily: "Inter_500Medium" },
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
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E0E7E3",
  },
  cardText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#2E2E2E",
    textAlign: "right",
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
  },
  deleteBtn: {
    backgroundColor: "#FFE8E8",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontSize: 14, color: "#C0392B" },
});
