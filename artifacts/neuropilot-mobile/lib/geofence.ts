import Constants from "expo-constants";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  deleteScheduledTask,
  getScheduledTasks,
  getTask,
  setNextTask,
  setTask,
} from "./storage";

/**
 * Returns true when the app is running inside Expo Go (storeClient).
 * Geofencing is not supported in Expo Go — use this to gate related code.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

export const GEOFENCE_TASK = "neuropilot-geofence";
const ARRIVAL_CHANNEL_ID = "neuropilot-arrival";
const RADIUS_METERS = 100;

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register the high-importance Android notification channel used for
 * geofence arrival pings. Higher importance = ring + vibrate + show
 * on lock screen even when Do-Not-Disturb is off. Safe to call at
 * any point; Android dedupes by channel id.
 */
export async function ensureArrivalNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ARRIVAL_CHANNEL_ID, {
      name: "تنبيهات الوصول للمكان",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4A6FA5",
      enableVibrate: true,
      showBadge: false,
    });
  } catch {
    // Don't crash app launch if the channel can't be registered.
  }
}

async function fireArrivalNotification(body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "NeuroPilot 📍",
        body,
        sound: "default",
      },
      trigger:
        Platform.OS === "android"
          ? ({
              channelId: ARRIVAL_CHANNEL_ID,
            } as unknown as Notifications.NotificationTriggerInput)
          : null,
    });
  } catch {}
}

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

// Background task — fires whenever any of the registered places are
// entered. We look at scheduled tasks for that placeId, promote the
// oldest one to active (or queue it as next), and ping the user.
TaskManager.defineTask(
  GEOFENCE_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<GeofenceTaskData>) => {
    if (error || !data) return;
    if (data.eventType !== Location.GeofencingEventType.Enter) return;

    const placeId = data.region.identifier ?? "";
    const [scheduled, active] = await Promise.all([
      getScheduledTasks(),
      getTask(),
    ]);

    const arrival = scheduled
      .filter((t) => t.locationId === placeId)
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    if (!arrival) {
      // Geofence still armed but no scheduled task for this place. If
      // the active task happens to live here, remind the user.
      if (active && active.locationId === placeId) {
        await fireArrivalNotification(`وصلت! حان وقت مهمتك: ${active.title}`);
      }
      return;
    }

    await deleteScheduledTask(arrival.id);
    const promoted = {
      title: arrival.title,
      sessions: [],
      currentDuration: arrival.currentDuration,
      locationId: arrival.locationId,
    };

    if (!active) {
      await setTask(promoted);
      await fireArrivalNotification(`حان وقت مهمتك: ${arrival.title}`);
    } else {
      await setNextTask(promoted);
      await fireArrivalNotification(
        `وصلت! مهمتك الجاية جاهزة: ${arrival.title}`,
      );
    }
  },
);

export type PermissionDeniedReason = "notifications" | "foreground" | "background";

export interface PermissionResult {
  granted: boolean;
  reason: PermissionDeniedReason | null;
}

export async function requestPermissions(): Promise<PermissionResult> {
  await ensureArrivalNotificationChannel();

  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== "granted") return { granted: false, reason: "notifications" };

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return { granted: false, reason: "foreground" };

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") return { granted: false, reason: "background" };

  return { granted: true, reason: null };
}

export interface GeofenceTarget {
  placeId: string;
  latitude: number;
  longitude: number;
}

/**
 * Replace the set of places the native geofence is monitoring. Each
 * arrival is attributed to its place via the LocationRegion.identifier.
 * An empty list stops the watcher entirely.
 */
export async function setGeofenceTargets(
  targets: GeofenceTarget[],
): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (registered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
    if (targets.length === 0) return;
    await Location.startGeofencingAsync(
      GEOFENCE_TASK,
      targets.map((t) => ({
        identifier: t.placeId,
        latitude: t.latitude,
        longitude: t.longitude,
        radius: RADIUS_METERS,
      })),
    );
  } catch {
    // Device may not support background location; ignore silently.
  }
}

export async function stopGeofence(): Promise<void> {
  try {
    const hasTask = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (hasTask) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch {}
}

export async function isGeofenceActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

/**
 * @deprecated kept for compat; rewrites the watcher to a single
 * anonymous target. New callers should use setGeofenceTargets.
 */
export async function startGeofence(
  latitude: number,
  longitude: number,
): Promise<void> {
  await setGeofenceTargets([{ placeId: "__legacy__", latitude, longitude }]);
}
