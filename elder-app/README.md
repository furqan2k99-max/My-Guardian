# MyGuardian — Elder App

Native **Android** app for the elder side of MyGuardian (Kotlin + Jetpack
Compose). **Phase 0 shell only**: onboarding + pairing. No call screening, no
SMS reading, no on-device detection, no background services yet — those come
with the detection milestone.

Consumes the same backend as `../guardian-app` (`../backend`).

## Current flow

1. **Welcome** — what MyGuardian does, in plain language
2. **About permissions** — explains phone/call, SMS, and notification
   permissions *before* any OS prompt. **No permission is requested yet.**
3. **Connect with your guardian** — elder enters their phone number (hashed
   on-device, only the hash is sent) + the guardian's **6-character invite
   code** → `POST /auth/dev-login` (role `elder`) then
   `POST /family-links/accept`. The code field auto-uppercases, keeps only
   letters/digits, and the accept is case/space-insensitive; codes expire
   server-side after 15 minutes.
4. **You're all set** — placeholder confirmation

A successful pair is remembered; next launch goes straight to the confirmation
screen.

## Requirements

- Android Studio (bundles JDK 17 + SDK) — or a JDK 17 and an Android SDK
  manually on your path
- The MyGuardian backend running locally (see `../backend/README.md`), with
  dev-login enabled (it is in `npm run dev`; disabled in production)

## Pointing at the backend

The app reads **`MYGUARDIAN_API_URL`** (default `http://10.0.2.2:4000`). Set it
one of these ways:

- Environment variable:
  ```powershell
  $env:MYGUARDIAN_API_URL = "http://10.0.2.2:4000"
  ```
- Gradle property in `elder-app/gradle.properties`:
  ```properties
  MYGUARDIAN_API_URL=http://10.0.2.2:4000
  ```

| Where the app runs | `MYGUARDIAN_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000` |
| Physical device (via Android Studio) | `http://<your-LAN-IP>:4000` (same Wi-Fi) |

Notes:

- The value is baked into `BuildConfig.API_BASE_URL` at build time — rebuild
  (or re-sync + build) after changing it.
- Debug builds allow cleartext HTTP (`usesCleartextTraffic="true"`) for LAN
  development. Remove that flag and add a `network_security_config` before any
  release build.

## Building & running

Open this folder in Android Studio, let Gradle sync, then **Run**. Or from a
terminal:

```powershell
# JDK is picked up from gradle.properties (org.gradle.java.home) so JAVA_HOME
# does not need to be set. Otherwise: use Android Studio, or export JAVA_HOME
# to a JDK 17.
.\gradlew.bat installDebug
```

Then open **MyGuardian** from the launcher (or `adb shell
monkey -p com.myguardian.elder 1`).

### To try the pairing end-to-end

1. Backend running (`npm run dev`, port 4000).
2. Guardian app: login, generate the invite code, note it.
3. Elder app on an emulator/device: walk through onboarding, enter the phone
   number + the invite code, tap **Connect**.
4. Guardian app flips to the alerts dashboard once the link is active.

## Stack & structure

```
app/src/main/java/com/myguardian/elder/
  MainActivity.kt            — edge-to-edge + token store + theme + nav
  theme/Theme.kt             — high-contrast palette, large typography
  ui/Components.kt           — ElderScreen, BigButton (64dp target), InfoPanel
  ui/MyGuardianApp.kt        — NavHost (welcome -> permissions -> pair -> done)
  screens/                   — Welcome, Permissions, Pair, Done
  data/ApiClient.kt          — HttpURLConnection client, shapes verified with backend
  data/TokenStore.kt         — SharedPreferences for the shell (see note)
app/src/main/res/            — manifest, adaptive-icon, platform theme
```

Versions: Kotlin 2.0.21, AGP 8.7.3, Gradle 8.10.2, Compose BOM 2024.10.01,
compile/target SDK 35, min SDK 26.

## Constraints honored (shell milestone)

- **No runtime permissions are requested** — SMS / call role / notifications are
  declared in the manifest (documentation for the next milestone) and only
  *explained* in the app.
- **No CallScreeningService, no background services**, no detection logic.
- Token storage is plain SharedPreferences until the detection milestone (then
  move to Keystore-backed storage).

## Known UX notes

- Invite codes are now **short (6 chars) with a 15-minute server-side TTL**, so
  a guardian can read them aloud or share them by text. If an elder sees an
  error after entering a code, the guardian may have generated a new one to
  replace an expired code. Remaining awkwardness: the exchange still requires
  the guardian to relay the code (voice/message) — a future "scan a QR" or
  device-to-device link would remove that step entirely.