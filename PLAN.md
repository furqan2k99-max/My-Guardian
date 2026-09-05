# MyGuardian — Plan

Two-app fraud-protection system for elderly users. This document is the
source of truth for what the product is and what remains to be built. It is
updated to reflect reality as the project changes.

## 1. Current scope

MyGuardian protects an elderly user by watching two channels and alerting a
trusted guardian:

- **Call protection** — detect risky/unknown incoming calls and give the
  guardian a heads-up while the elder stays in control.
- **Email / link scanning** — spot unsafe links in email and flag them.
- **Guardian alerts** — backend push (FCM) + guardian-app alert feed.

**SMS is explicitly OUT** for this version. SMS content/sender protection was
dropped because modern Android makes it infeasible without taking over the
SMS app (see [Decisions & pivots](#5-decisions--pivots)). It may be revisited
only with real user feedback, and only as the default-SMS-app path.

## 2. Detection channels — reality vs. original vision

The original plan envisioned three channels (calls, texts, email/links).

| Channel | Status | Notes |
| --- | --- | --- |
| Calls | Capture **done**; scoring/audio/STT **not started** | CallScreeningService logs number + state; the app must be the user's **call screening app** (a Settings selection, not the default dialer). |
| Email / links | **Not started** (backend URL-reputation API exists) | Shares the backend's URL reputation endpoint. |
| SMS content | **Abandoned** | Android 8.0+ delivers `SMS_RECEIVED` only to the default SMS app; a NotificationListenerService sees redacted content (title, text, conversation Person, messages all stripped). |
| SMS sender-reputation (no body) | **Abandoned** | Same redaction strips the sender identifier too — nothing to base a reputation check on. |

## 3. Architecture

- `backend/` — shared Node/TS + Express + Prisma API: auth, family linking
  (invite codes), flagged events, URL reputation, FCM push. `docs/openapi.yaml`
  is the mobile contract.
- `guardian-app/` — React Native (Expo) app for the trusted family member:
  auth, pairing, alerts feed, push registration.
- `elder-app/` — native Android (Kotlin/Compose) app on the elder's phone:
  onboarding, pairing, call detection capture. Future: alert display.

## 4. Phases & status

| Phase | Content | Status |
| --- | --- | --- |
| 0 | Backend foundation (auth, family linking, push), guardian-app shell, elder-app onboarding + pairing | **Done** |
| 1 | Detection: call capture (CallScreeningService logging number/state) | **Done** |
| 1b | Call scoring, audio capture, speech-to-text, NLP pipeline | **Not started** (intentionally deferred — separate milestone after capture is proven) |
| 2 | Link checking on the elder client (share-sheet + paste → scan verdict; dangerous results auto-flag to guardians) | **Done (degraded mode)** — verdicts are "unknown" until a Safe Browsing key is configured |
| 3 | Guardian alerts UX polish + elder-side alert display | Partially done (guardian push + feed + event detail/review work; elder-side warning display pending) |
| — | SMS (any flavor) | **Abandoned** |

## 5. Decisions & pivots

- **SMS content reading dropped (2026-08-19).** Verified on Android 15 (API 35):
  `SMS_RECEIVED` goes only to the default-SMS-app holder, and a
  NotificationListenerService receives redacted message notifications —
  title, text, the conversation Person, and the messages array are all
  stripped before delivery. Evidence: `SMS-CAPTURE-ANDROID-LIMITATION.md`.
- **SMS sender-reputation dropped (same day).** A follow-up verification showed
  the redaction also removes the sender identifier (empty `EXTRA_TITLE`,
  empty Person, opaque messages Bundle) — sender-reputation-only detection is
  not viable either. This is consistent with a deliberate Android anti-abuse
  measure (NLS-based SMS scraping was used by banking malware for OTP theft).
- **Product scope re-focused.** Call protection + email/link scanning +
  guardian alerts are the core. SMS may return later only via the
  default-SMS-app path, pending real user feedback on whether it's missed.
- **Call screening needs a Settings selection.** CallScreeningService requires
  the app to be the user's **call screening app** (`android.app.role.CALL_SCREENING`
  on Android 14+). The Settings entry (`Settings.ACTION_CALL_SCREENING_SETTINGS`)
  does not resolve on the test emulator, so onboarding must detect that and
  fall back to manual instructions.
- **Auth = Firebase email/password (2026-08-22).** Phone-number OTP was built
  and verified up to Google's servers, but real SMS requires Cloud Billing
  (Blaze) on this project — deferred for budget. Swapped both apps to
  email/password (`createUser`/`signIn` via the same Firebase project; Spark
  plan, no billing). Backend `/auth/firebase-login` verifies ID tokens with
  the Admin SDK and keys users by the server-side SHA-256 of the verified
  email (the `phone_number_hash` column stores that identity hash; dev-login
  rows keep their old test hashes and simply never match real logins). The
  elder app's phone/OTP UI and helper were removed; phone OTP may return for
  elders if SMS budget appears.
- **Live call audio: infeasible for third-party apps (investigated 2026-08).**
  Confirmed on API 35 emulator and in current docs/CTS: `VOICE_CALL` /
  `VOICE_UPLINK` / `VOICE_DOWNLINK` sources throw `UnsupportedOperationException`
  without the signature-level `CAPTURE_AUDIO_OUTPUT`; during `MODE_IN_CALL` even
  `MIC` / `VOICE_COMMUNICATION` capture is silenced (measured 0.0 RMS mid-call
  vs noise-floor baseline; same behavior reported on Samsung hardware).
  `CallScreeningService` is metadata-only. A sanctioned interception pathway
  (`Call.STATE_AUDIO_PROCESSING`, `AUDIO_PROCESSING_USE_CASE_CALL_SCREENING`)
  exists only as flagged API 37 (unreleased). Default-dialer status does not
  grant telephony-audio ownership across OEMs. Elder-initiated reporting plus
  number/link reputation remain the detection strategy until that API ships.
- **Hardening pass (2026-08-22).** Jest runs against an isolated
  `myguardian_test` database (never dev data); elder session storage moved to
  EncryptedSharedPreferences with plaintext migration; expired sessions renew
  silently from the still-signed-in Firebase account on both apps; cleartext
  HTTP locked down to the emulator loopback only; signed release builds exist
  for both apps (elder uses its own keystore — passwords in gradle.properties
  are development-only). Known gotcha: this AVD restores stale snapshots on
  cold boot, which can revert installed APKs — prefer `-no-snapshot` or wipe
  data when apps and JS fall out of sync.

## 6. Repositories

| Folder | Project | Tech |
| --- | --- | --- |
| `backend/` | Shared API (elders + guardians) | Node/TS, Express, Prisma, PostgreSQL |
| `guardian-app/` | Guardian mobile app | React Native + Expo + TypeScript |
| `elder-app/` | Elder Android app | Kotlin + Jetpack Compose |