import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { getTask } from "./storage";

export const GEOFENCE_TASK = "neuropilot-geofence";
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

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

// Define the background task — must be called at module level (top of file)
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<GeofenceTaskData>) => {
  if (error || !data) return;
  if (data.eventType === Location.GeofencingEventType.Enter) {
    const task = await getTask();
    const title = task?.title ?? "مهمتك";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "NeuroPilot 📍",
        body: `حان وقت مهمتك: ${title}`,
        sound: true,
      },
      trigger: null, // fire immediately
    });
  }
});

export async function requestPermissions(): Promise<boolean> {
  // Notification permission
  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== "granted") return false;

  // Foreground location
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return false;

  // Background location (needed for geofencing)
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return bgStatus === "granted";
}

export async function startGeofence(latitude: number, longitude: number): Promise<void> {
  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK, [
      { latitude, longitude, radius: RADIUS_METERS },
    ]);
  } catch {
    // Silently ignore — device may not support background location
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
