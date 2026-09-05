package com.myguardian.elder.call

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.myguardian.elder.MainActivity
import com.myguardian.elder.R
import com.myguardian.elder.data.CapturedCallsStore

/**
 * Phase B call detection — capture + elder-initiated reporting.
 *
 * Each screened incoming call is saved to the on-device recent-calls list and
 * surfaces a local notification ("Recent call from X") that opens the app's
 * report screen. The call itself is ALWAYS allowed through — MyGuardian never
 * blocks or scores calls yet; the elder decides what's worth reporting.
 *
 * Requires the CALL_PHONE runtime permission; it does NOT require the app to
 * be the default dialer. Telecom binds this service when an incoming call
 * arrives (calls already in the device contacts do not reach screening).
 */
class CallScreenService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val number = callDetails.handle?.schemeSpecificPart ?: "unknown"
        val state = callDetails.state
        val direction = callDetails.getCallDirection()

        Log.i(
            TAG,
            "Call captured number=$number state=${describeState(state)}($state) " +
                "direction=${describeDirection(direction)}($direction)",
        )

        if (direction == Call.Details.DIRECTION_INCOMING ||
            direction == Call.Details.DIRECTION_UNKNOWN
        ) {
            CapturedCallsStore(this).add(number)
            showRecentCallNotification(number)
        }

        respondToCall(callDetails, CallResponse.Builder().build())
    }

    /**
     * Posts a local "recent call" notification whose tap opens the report
     * screen. Best-effort: without POST_NOTIFICATIONS (Android 13+) this is a
     * silent no-op and the call still appears in the in-app list.
     */
    private fun showRecentCallNotification(number: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_RECENT_CALLS,
                    "Recent calls",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
            )
        }

        val openApp = Intent(this, MainActivity::class.java).apply {
            putExtra(MainActivity.EXTRA_OPEN, MainActivity.OPEN_CALLS)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this,
            number.hashCode(),
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_RECENT_CALLS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Recent call")
            .setContentText("Call from $number — was it suspicious?")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Call from $number — was it suspicious? " +
                        "Tap to let your guardian know."),
            )
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        runCatching { NotificationManagerCompat.from(this).notify(number.hashCode(), notification) }
    }

    private fun describeState(state: Int): String = when (state) {
        Call.STATE_NEW -> "NEW"
        Call.STATE_RINGING -> "RINGING"
        Call.STATE_DIALING -> "DIALING"
        Call.STATE_ACTIVE -> "ACTIVE"
        Call.STATE_HOLDING -> "HOLDING"
        Call.STATE_DISCONNECTED -> "DISCONNECTED"
        Call.STATE_DISCONNECTING -> "DISCONNECTING"
        Call.STATE_SELECT_PHONE_ACCOUNT -> "SELECT_PHONE_ACCOUNT"
        else -> "?"
    }

    private fun describeDirection(direction: Int): String = when (direction) {
        Call.Details.DIRECTION_INCOMING -> "INCOMING"
        Call.Details.DIRECTION_OUTGOING -> "OUTGOING"
        Call.Details.DIRECTION_UNKNOWN -> "UNKNOWN"
        else -> "?"
    }

    private companion object {
        const val TAG = "MyGuardianCall"
        const val CHANNEL_RECENT_CALLS = "recent_calls"
    }
}