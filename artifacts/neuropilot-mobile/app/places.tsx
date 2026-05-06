import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deletePlace, getPlaces, Place, savePlace } from "@/lib/places";

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<Place[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPlaces().then(setPlaces);
    }, [])
  );

  const handleSaveHere = async () => {
    const name = nameInput.trim();
    if (!name) {
      Alert.alert("اسم المكان", "اكتب اسم المكان الأول");
      return;
    }

    setSaving(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تصريح الموقع", "محتاج تصريح الموقع عشان تحفظ المكان ده");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const place: Place = {
        id: Date.now().toString(),
        name,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      await savePlace(place);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNameInput("");
      setPlaces(await getPlaces());
    } catch {
      Alert.alert("خطأ", "مقدرناش نحصل على موقعك دلوقتي. حاول تاني.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("مسح المكان", "تمسح المكان ده؟", [
      { text: "لأ", style: "cancel" },
      {
        text: "امسح",
        style: "destructive",
        onPress: async () => {
          await deletePlace(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setPlaces(await getPlaces());
        },
      },
    ]);
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.backText}>← رجوع</Text>
        </Pressable>
        <Text style={styles.title}>أماكنك</Text>
      </View>

      {/* Save current location */}
      <View style={styles.addSection}>
        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="اسم المكان (مثلاً: البيت، الشغل)"
          placeholderTextColor="#6B7E80"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleSaveHere}
        />
        <View style={styles.btnRow}>
          <Pressable
            onPress={handleSaveHere}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              styles.btnFlex,
              { opacity: pressed || saving ? 0.7 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>📍 موقعي الحالي</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/map-picker",
                params: nameInput.trim() ? { initialName: nameInput.trim() } : {},
              })
            }
            style={({ pressed }) => [
              styles.mapBtn,
              styles.btnFlex,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.mapBtnText}>🗺️ اختار من الخريطة</Text>
          </Pressable>
        </View>
      </View>

      {/* Saved places list */}
      {places.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            محدش محفوظ لسه.{"\n"}احفظ أماكنك المهمة وربطها بمهامك!
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.placeRow}>
              <Text style={styles.placeIcon}>📍</Text>
              <Text style={styles.placeName}>{item.name}</Text>
              <Pressable
                onPress={() => handleDelete(item.id)}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.deleteText}>×</Text>
              </Pressable>
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
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    color: "#4A6FA5",
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
  },
  addSection: {
    gap: 12,
    marginBottom: 28,
  },
  input: {
    borderWidth: 2,
    borderColor: "#4A6FA5",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#2E2E2E",
    backgroundColor: "#fff",
    textAlign: "right",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnFlex: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: "#4A6FA5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  mapBtn: {
    backgroundColor: "#7FB069",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  mapBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    lineHeight: 26,
  },
  list: {
    gap: 12,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E0E7E3",
  },
  placeIcon: {
    fontSize: 20,
  },
  placeName: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: "#2E2E2E",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    fontSize: 20,
    color: "#C0392B",
    lineHeight: 22,
  },
});
