import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { clearPendingTask, getPendingTask, getTask, setNextTask, setTask } from "./storage";

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
    const [pendingTask, activeTask] = await Promise.all([getPendingTask(), getTask()]);

    if (!pendingTask) {
      // No pending task — fire arrival notification for the active task if one exists
      if (activeTask) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "NeuroPilot 📍",
            body: `وصلت! حان وقت مهمتك: ${activeTask.title}`,
            sound: true,
          },
          trigger: null,
        });
      }
      return;
    }

    if (!activeTask) {
      // No active task — promote pending to active
      await setTask(pendingTask);
      await clearPendingTask();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "NeuroPilot 📍",
          body: `حان وقت مهمتك: ${pendingTask.title}`,
          sound: true,
        },
        trigger: null,
      });
    } else {
      // Active task running — queue pending as next task
      await setNextTask(pendingTask);
      await clearPendingTask();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "NeuroPilot 📍",
          body: `وصلت! مهمتك الجاية جاهزة: ${pendingTask.title}`,
          sound: true,
        },
        trigger: null,
      });
    }
  }
});

export type PermissionDeniedReason = "notifications" | "foreground" | "background";

export interface PermissionResult {
  granted: boolean;
  reason: PermissionDeniedReason | null;
}

export async function requestPermissions(): Promise<PermissionResult> {
  // Notification permission
  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== "granted") return { granted: false, reason: "notifications" };

  // Foreground location
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return { granted: false, reason: "foreground" };

  // Background location (needed for geofencing)
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") return { granted: false, reason: "background" };

  return { granted: true, reason: null };
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

export async function isGeofenceActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}
