package com.myguardian.elder.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/**
 * DORMANT reference — registered in the manifest but never fires on modern
 * Android (SMS_RECEIVED is delivered only to the default SMS app, which
 * MyGuardian is not). Kept because SMS protection may be revisited.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) {
            Log.w(TAG, "SMS_RECEIVED broadcast with no messages")
            return
        }

        val sender = messages.firstOrNull()?.originatingAddress ?: "unknown"
        val body = messages.joinToString(separator = "") { it.messageBody ?: "" }

        Log.i(TAG, "SMS captured sender=$sender body=$body")
    }

    private companion object {
        const val TAG = "MyGuardianSms"
    }
}