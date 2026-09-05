# SMS capture on modern Android — Phase A finding (2026-08-19)

## Status
Phase A (NotificationListenerService capture) is **stopped**. Capture *detection*
works; message *content* is unavailable. This is treated as a **likely systemic
Android anti-abuse policy**, not an environment-specific bug.

## What was implemented
- `elder-app/.../notification/SmsNotificationListener.kt` — a
  `NotificationListenerService` that watches notifications from the default
  messaging app (Google Messages, `com.google.android.apps.messaging`) and logs
  sender + preview to Logcat (`MyGuardianSms` tag). No scoring, no flagging, no
  backend calls.
- Correct access flow used: notification access has no runtime permission
  dialog; the app launches `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`
  (with `Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME`) and grant state is
  read from `Settings.Secure` `enabled_notification_listeners`.
- The earlier SMS receiver approach (`SMS_RECEIVED` broadcast) was abandoned
  because since Android 8.0 the broadcast is delivered only to the
  default-SMS-app holder.

## Test performed (and how)
- Emulator: API 35 (Android 15), `google_apis` image.
- Enabled the listener via `cmd notification allow_listener
  com.myguardian.elder/.notification.SmsNotificationListener`.
- Injected fake SMS: `adb emu sms send 15551234567 "URGENT: your account will be
  suspended, verify payment now"`.

## Evidence captured
Listener connect:
```
I MyGuardianSms: notification listener connected
```
On SMS injection, the listener fires but content arrives redacted:
```
I MyGuardianSms: SMS notification captured sender=unknown preview=Sensitive notification content hidden vis=private
I MyGuardianSms: SMS notification captured (no readable content) vis=private keys=android.title,android.reduced.images,android.subText,android.showChronometer,android.text,android.progress,android.progressMax,android.appInfo,android.showWhen,android.largeIcon,android.infoText,android.progressIndeterminate,android.remoteInputHistory
```
Findings:
- Google Messages posts its SMS notifications as `VISIBILITY_PRIVATE`.
- On this device/OS the system delivers them to the listener already redacted:
  the group summary's content is replaced with the framework placeholder
  "Sensitive notification content hidden"; the per-message notification keeps
  the extras *keys* but the `android.title` / `android.text` values are empty.
- A different Messages notification ("Messages is doing work in the background")
  DID deliver readable text — so content *can* reach the listener; it is the
  SMS notifications specifically that are redacted.
- Controllable factors were checked and excluded: no lock screen on the emulator
  (`locksettings get-disabled=true`, no password salt, `deviceLocked=0`), and
  the Android 14 `sensitive_notification_policy` is default (setting it to
  `always_show` changed nothing).

## Interpretation
This is **consistent with a deliberate Android anti-abuse measure**: NLS-based
SMS scraping has been widely used by banking malware for OTP theft, so Android
redacts private-visibility message notifications before they reach listeners.
If that is what is happening, **it will not be fixable on real hardware either** —
real-device testing would only confirm/deny the mechanism, not change it.

## Implications to decide on (product)
- Becoming the default SMS app (via `RoleManager`/`android.app.role.SMS`) is the
  only standard path that yields full SMS *content* on modern Android — at the
  cost of taking over the elder's texting app.
- Alternatives that avoid SMS content entirely:
  - focus on call detection (incoming-call signals + CallScreeningService), and
  - link/URL scanning from other vectors where content is available.
- If SMS text scanning remains a goal, revisit with a real-device test first to
  confirm whether this redaction holds on production hardware.

## Not done (per scope)
- No risk scoring, no auto-flagging, no backend calls for SMS content.
- No further time spent tweaking emulator configuration.

## Follow-up verification (2026-08-19): sender number availability
After the pivot to sender-reputation-only detection, the question was whether the
sender's phone number survives redaction even though the body/preview is hidden.

Test: 3 fake SMS injected from different numbers (`15551234567`,
`14155552671`, `15559998888`) via `adb emu sms send`; the listener dumped every
field on each notification object (all `VISIBILITY_PRIVATE`).

Result — **the sender's number is UNAVAILABLE.** Redaction is consistent (not
flaky) and strips every identifier. For all three conversations, every repost
showed the same shape:
```
title=''                          <- EXTRA_TITLE cleared (was empty string, not even a name/number)
text='Sensitive notification content hidden'
user.name='' user.uri='null' user.key='null'   <- conversation Person stripped
messages=1 | m0 <opaque Bundle>   <- messages array is an opaque parcelled Bundle, not readable Message objects
convId=<1|2|3>                    <- Messages-internal conversation id only; maps to nothing usable
```
Also absent: `EXTRA_SENDER_PERSON`, `EXTRA_PEOPLE`, any `tel:`/`sms:` URI.
The earlier "sender=unknown / empty android.title" log lines were the SAME
consistent redaction, not an inconsistency.

The only theoretical paths to a number would go beyond the notification object
(resolving the conversation shortcut's deep link, or mapping the internal
conversation id through a provider) — both effectively re-read SMS data, which
is what the product is pivoting away from, and neither was pursued.

Verdict: **sender-reputation-only SMS detection via NotificationListenerService
is not viable** — there is no sender identifier to base a reputation check on.
SMS-based detection (any flavor) would require either the default-SMS-app role
or reading SMS data directly. Call analysis and email/OAuth remain unaffected.

## Phase B call screening finding (2026-08-19)
CallScreeningService does NOT require the default-DIALER role (as expected), but
on Android 10+/15 Telecom binds only ONE screening service: the **default call
screening app**. On this emulator that was the Google dialer; injecting a call
produced `SCREENING_BOUND` for the dialer and never our service. Setting
`android.app.role.CALL_SCREENING` via `cmd role add-role-holder
android.app.role.CALL_SCREENING com.myguardian.elder 0` made our
CallScreenService fire on every incoming call. The Settings screen for this
(`Settings.ACTION_CALL_SCREENING_SETTINGS`) did not resolve on the emulator, so
onboarding will need to guide the user to the correct Settings location, and
real devices should be checked for where this selection lives.