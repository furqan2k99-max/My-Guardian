package com.myguardian.elder.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Locally captured incoming calls (from CallScreenService), newest first.
 * Device-only: nothing leaves the phone until the elder explicitly reports a
 * call. Keeps a small rolling window plus which entries were already reported.
 */
class CapturedCallsStore(context: Context) {
    private val prefs = context.getSharedPreferences("captured_calls", Context.MODE_PRIVATE)

    data class CapturedCall(val number: String, val at: Long)

    /** Adds a capture, deduping repeats of the same number within a minute. */
    fun add(number: String) {
        val calls = all().toMutableList()
        val now = System.currentTimeMillis()
        if (calls.firstOrNull()?.let { it.number == number && now - it.at < 60_000L } == true) {
            return
        }
        calls.add(0, CapturedCall(number, now))
        save(calls.take(MAX_ENTRIES))
    }

    fun all(): List<CapturedCall> {
        val raw = prefs.getString(KEY_CALLS, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).map { i ->
                val obj = array.getJSONObject(i)
                CapturedCall(obj.getString(KEY_NUMBER), obj.getLong(KEY_AT))
            }
        }.getOrDefault(emptyList())
    }

    fun keyOf(call: CapturedCall): String = "${call.number}|${call.at}"

    fun markReported(call: CapturedCall) {
        prefs.edit().putStringSet(KEY_REPORTED, reportedKeys() + keyOf(call)).apply()
    }

    fun isReported(call: CapturedCall): Boolean = keyOf(call) in reportedKeys()

    private fun reportedKeys(): Set<String> =
        prefs.getStringSet(KEY_REPORTED, emptySet()) ?: emptySet()

    private fun save(calls: List<CapturedCall>) {
        val array = JSONArray()
        calls.forEach { call ->
            array.put(
                JSONObject().put(KEY_NUMBER, call.number).put(KEY_AT, call.at),
            )
        }
        prefs.edit().putString(KEY_CALLS, array.toString()).apply()
    }

    private companion object {
        const val KEY_CALLS = "calls"
        const val KEY_REPORTED = "reported_keys"
        const val KEY_NUMBER = "number"
        const val KEY_AT = "at"
        const val MAX_ENTRIES = 20
    }
}