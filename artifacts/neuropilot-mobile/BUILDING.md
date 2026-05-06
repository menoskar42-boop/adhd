# Building NeuroPilot Mobile — EAS Build Guide

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
# Install the EAS CLI globally (version >= 12.0.0 required)
npm install -g eas-cli

# Log in to your Expo account (create one free at expo.dev if needed)
eas login
```

---

## Build Profiles

Three profiles are defined in `eas.json`. All iOS builds use bundle identifier
`com.neuropilot.mobile` (mirroring `app.json`).

### `development` — dev client for active feature work

Builds a **development client**: a custom binary that connects to your local Expo
dev server, with all native modules (geofencing, notifications) included.

- **Distribution**: internal (install via QR code / EAS link)
- **iOS**: signed for real device, bundle ID `com.neuropilot.mobile`
- **Android**: debug **APK** (sideload directly — no Play Store needed)

```bash
eas build --profile development --platform android   # easiest, no provisioning
eas build --profile development --platform ios       # requires Apple Developer account
```

After the build finishes, EAS will give you a QR code / download link.
Install the resulting `.apk` (Android) or `.ipa` (iOS) on your device.

#### Connecting to the dev server

Once the dev build is installed, start the Expo dev server as usual:

```bash
pnpm --filter @workspace/neuropilot-mobile run dev
```

Open the installed NeuroPilot app on your device and scan the QR code shown in
the terminal (or enter the URL manually). The app will load from your dev server
and all geofence + notification features will work.

---

### `preview` — internal testing (no dev server required)

Builds a **release-mode** binary without a development client — closest to
production behaviour, but distributed internally for QA and stakeholder testing.

- **Distribution**: internal (install via QR code / EAS link)
- **iOS**: signed for internal distribution, bundle ID `com.neuropilot.mobile`
- **Android**: release **APK** (easy to sideload on any Android device)

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Run this profile before every store submission to complete full regression testing.

---

### `production` — store-ready submission build

Builds an optimised, **store-ready** binary with auto-incrementing build numbers.

- **iOS**: App Store distribution, bundle ID `com.neuropilot.mobile`
- **Android**: **AAB (Android App Bundle)** — required by the Google Play Store
- Build numbers auto-increment on each run (`autoIncrement: true`)

```bash
eas build --profile production --platform android
eas build --profile production --platform ios

# Build both platforms in one command:
eas build --profile production --platform all
```

---

## Store Submission

Fill in the placeholder values in `eas.json` under `submit.production` before running:

| Field | Where to find it |
|---|---|
| `ios.appleId` | Your Apple ID email |
| `ios.ascAppId` | App Store Connect → App → App Information → Apple ID |
| `ios.appleTeamId` | Apple Developer portal → Membership |
| `android.serviceAccountKeyPath` | Google Play Console → Setup → API access → Service account JSON key |

Submit a completed production build:

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Or trigger a build **and** submit in one step:

```bash
eas build --profile production --platform all --auto-submit
```

---

## Profile comparison

| Feature | Expo Go | `development` | `preview` | `production` |
|---|---|---|---|---|
| UI, navigation, haptics | ✅ | ✅ | ✅ | ✅ |
| Save & view places | ✅ | ✅ | ✅ | ✅ |
| Geofence-based location reminders | ❌ | ✅ | ✅ | ✅ |
| Background location tasks | ❌ | ✅ | ✅ | ✅ |
| Local push notifications | ❌ | ✅ | ✅ | ✅ |
| Needs local dev server | — | ✅ | ❌ | ❌ |
| Android output | — | APK (debug) | APK (release) | AAB |
| iOS output | — | IPA (internal) | IPA (internal) | IPA (App Store) |
| Distribution | — | Internal | Internal | App Store / Play Store |

## Notes

- Background location and geofencing require a **development client** — Expo Go does not support these APIs.
- The `preview` and `production` iOS builds require an active **Apple Developer Program** membership ($99/year).
- The `production` Android build produces an AAB; use the `preview` profile to get a sideload-friendly APK.
- `APP_ENV` is set per profile (`development` | `preview` | `production`) and available via `process.env.APP_ENV` at build time.
