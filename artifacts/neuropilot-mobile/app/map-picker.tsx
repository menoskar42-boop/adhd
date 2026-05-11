import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { savePlace } from "@/lib/places";

// Type-only imports — purely compile-time, never run, so they don't trigger the
// native module registration error in Expo Go.
import type MapViewType from "react-native-maps";
import type { MapPressEvent, Marker as MarkerType, Region } from "react-native-maps";

// Runtime lazy-load: guarded so Expo Go doesn't crash on missing native module.
let MapViewComponent: typeof MapViewType | null = null;
let MarkerComponent: typeof MarkerType | null = null;
let mapsAvailable = false;

try {
  const maps = require("react-native-maps") as typeof import("react-native-maps");
  MapViewComponent = maps.default;
  MarkerComponent = maps.Marker as unknown as typeof MarkerType;
  mapsAvailable = true;
} catch {
  // Native module RNMapsAirModule not registered — running in Expo Go
}

const DEFAULT_REGION: Region = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function UnavailableFallback() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.fallback,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.fallbackIcon}>🗺️</Text>
      <Text style={styles.fallbackTitle}>الخريطة مش متاحة</Text>
      <Text style={styles.fallbackBody}>
        ميزة اختيار المكان من الخريطة بتحتاج{"\n"}
        <Text style={styles.fallbackBold}>Expo Dev Client</Text> أو نسخة مثبّتة من التطبيق.
        {"\n\n"}
        في الوقت الحالي، استخدم زر{"\n"}
        <Text style={styles.fallbackBold}>"📍 موقعي الحالي"</Text>
        {"\n"}
        عشان تحفظ مكانك.
      </Text>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.backBtnText}>← رجوع</Text>
      </Pressable>
    </View>
  );
}

export default function MapPickerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ initialName?: string }>();

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nameInput, setNameInput] = useState(params.initialName ?? "");
  const [saving, setSaving] = useState(false);

  if (!mapsAvailable || !MapViewComponent || !MarkerComponent) {
    return <UnavailableFallback />;
  }

  const MapViewEl = MapViewComponent;
  const MarkerEl = MarkerComponent;

  const handleMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ latitude, longitude });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) {
      Alert.alert("اسم المكان", "اكتب اسم المكان الأول");
      return;
    }
    if (!pin) {
      Alert.alert("اختار موقع", "اضغط على الخريطة عشان تحدد المكان");
      return;
    }

    setSaving(true);
    try {
      await savePlace({
        id: Date.now().toString(),
        name,
        latitude: pin.latitude,
        longitude: pin.longitude,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("خطأ", "مقدرناش نحفظ المكان. حاول تاني.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Map */}
      <MapViewEl
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {pin && <MarkerEl coordinate={pin} pinColor="#4A6FA5" />}
      </MapViewEl>

      {/* Overlay hint */}
      {!pin && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>اضغط على الخريطة عشان تحدد المكان</Text>
        </View>
      )}

      {/* Top bar: back */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.topBtnText}>← رجوع</Text>
        </Pressable>
        <Text style={styles.topTitle}>اختار مكان على الخريطة</Text>
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="اسم المكان (مثلاً: البيت، الشغل)"
          placeholderTextColor="#6B7E80"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          textAlign="right"
        />

        {pin && (
          <Text style={styles.coords}>
            {pin.latitude.toFixed(5)}°، {pin.longitude.toFixed(5)}°
          </Text>
        )}

        <Pressable
          onPress={handleSave}
          disabled={saving || !pin}
          style={({ pressed }) => [
            styles.saveBtn,
            (!pin || saving) && styles.saveBtnDisabled,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>💾 احفظ المكان</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7F6",
  },
  fallback: {
    flex: 1,
    backgroundColor: "#F5F7F6",
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  fallbackIcon: {
    fontSize: 56,
    marginBottom: 4,
  },
  fallbackTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#2E2E2E",
    textAlign: "center",
  },
  fallbackBody: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
    textAlign: "center",
    lineHeight: 26,
  },
  fallbackBold: {
    fontFamily: "Inter_600SemiBold",
    color: "#4A6FA5",
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: "#4A6FA5",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  backBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  map: {
    flex: 1,
  },
  hint: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    backgroundColor: "rgba(46,46,46,0.72)",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: -24,
  },
  hintText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(245,247,246,0.92)",
  },
  topBtn: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  topBtnText: {
    fontSize: 16,
    color: "#4A6FA5",
    fontFamily: "Inter_500Medium",
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#2E2E2E",
    textAlign: "right",
  },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
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
    backgroundColor: "#F5F7F6",
  },
  coords: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7E80",
  },
  saveBtn: {
    backgroundColor: "#4A6FA5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  saveBtnDisabled: {
    backgroundColor: "#B0BEC5",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
