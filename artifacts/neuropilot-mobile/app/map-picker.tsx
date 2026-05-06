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
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { savePlace } from "@/lib/places";

const DEFAULT_REGION: Region = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapPickerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ initialName?: string }>();

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nameInput, setNameInput] = useState(params.initialName ?? "");
  const [saving, setSaving] = useState(false);

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
      <MapView
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {pin && (
          <Marker
            coordinate={pin}
            pinColor="#4A6FA5"
          />
        )}
      </MapView>

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
