package com.myguardian.elder.notification

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * DORMANT reference — not declared in the manifest and not wired into
 * onboarding. Kept because SMS protection may be revisited (would then need
 * the default-SMS-app role).
 *
 * Phase A SMS capture via notification access: watches notifications from the
 * default messaging app (Google Messages) and logs sender + message preview.
 * Verification (2026-08-19) showed Android redacts private-visibility message
 * notifications before delivery to the listener: title, text, the conversation
 * Person, and the messages array are all stripped — so no sender identifier or
 * body content is available.
 */
class SmsNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        Log.i(TAG, "notification listener connected")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != MESSAGING_PACKAGE) return

        val extras = sbn.notification.extras ?: return
        if (sbn.notification.visibility != Notification.VISIBILITY_PRIVATE) return

        val sender = extras
            .getCharSequence(Notification.EXTRA_TITLE)
            ?.toString()
            ?.takeIf { it.isNotBlank() }
        val text = extras
            .getCharSequence(Notification.EXTRA_TEXT)
            ?.toString()
            ?.takeIf { it.isNotBlank() }

        if (sender == null && text == null) {
            Log.i(TAG, "SMS notification captured (sender and preview unavailable — redacted by system)")
        } else {
            Log.i(
                TAG,
                "SMS notification captured sender=${sender ?: "unknown"} " +
                    "preview=${text ?: "(no preview)"}",
            )
        }
    }

    private companion object {
        const val TAG = "MyGuardianSms"
        const val MESSAGING_PACKAGE = "com.google.android.apps.messaging"
    }
}