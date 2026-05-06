# Building NeuroPilot Mobile — EAS Dev Build

Expo Go does not support background location (geofencing) or local notifications.
To test those features on a real device you need a **Development Build** — a custom
version of the app you install once, then use like a normal Expo dev server.

## One-time setup (on your own machine)

### 1. Link your Expo account project

EAS builds require a `projectId` in `app.json` that ties the app to your Expo account.

1. Go to [expo.dev](https://expo.dev) and create a new project (or open an existing one).
2. Copy the **Project ID** — a UUID shown on the project's dashboard page
   (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
3. Open `app.json` and replace the placeholder UUID with yours:
   ```json
   "extra": {
     "eas": {
       "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     }
   }
   ```
   The current value (`00000000-0000-0000-0000-000000000000`) is a nil UUID
   placeholder — swap it for the real UUID from your expo.dev dashboard.

> Without a valid `projectId`, the first `eas build` run will prompt you
> interactively and may create a mis-linked project on expo.dev.

### 2. Install the CLI and log in

```bash
# Install the EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account (create one free at expo.dev if needed)
eas login

# Build the dev client and install it on your device
#   Android (APK — easiest, no provisioning needed):
eas build --profile development --platform android

#   iOS (requires an Apple Developer account):
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
