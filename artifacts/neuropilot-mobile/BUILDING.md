# Building NeuroPilot Mobile — EAS Dev Build

Expo Go does not support background location (geofencing) or local notifications.
To test those features on a real device you need a **Development Build** — a custom
version of the app you install once, then use like a normal Expo dev server.

## One-time setup (on your own machine)

```bash
# 1. Install the EAS CLI globally
npm install -g eas-cli

# 2. Log in to your Expo account (create one free at expo.dev if needed)
eas login

# 3. Build the dev client and install it on your device
#    Android (APK — easiest, no provisioning needed):
eas build --profile development --platform android

#    iOS (requires an Apple Developer account):
eas build --profile development --platform ios
```

After the build finishes, EAS will give you a QR code / download link.
Install the resulting `.apk` (Android) or `.ipa` (iOS) on your device.

## Connecting to the dev server

Once the dev build is installed, start the Expo dev server as usual:

```bash
pnpm --filter @workspace/neuropilot-mobile run dev
```

Open the installed NeuroPilot app on your device and scan the QR code shown in
the terminal (or enter the URL manually). The app will load from your dev server
and all geofence + notification features will work.

## Features unlocked by the dev build

| Feature | Expo Go | Dev Build |
|---|---|---|
| UI, navigation, haptics | ✅ | ✅ |
| Save & view places | ✅ | ✅ |
| Geofence-based location reminders | ❌ | ✅ |
| Background location tasks | ❌ | ✅ |
| Local push notifications | ❌ | ✅ |

## Profiles

| Profile | Purpose |
|---|---|
| `development` | Dev client build — connects to your local Expo server |
| `preview` | Internal APK/IPA for stakeholder testing (no dev server needed) |
| `production` | App Store / Google Play submission |
