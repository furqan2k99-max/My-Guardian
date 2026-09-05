package com.myguardian.elder.data

import com.myguardian.elder.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/** Non-2xx backend response. `code` is the backend's machine code (e.g. INVALID_INVITE_CODE). */
class ApiError(val status: Int, val code: String, message: String) : Exception(message)

data class LoggedInUser(val id: String, val phoneNumberHash: String)

data class LoginResult(val token: String, val user: LoggedInUser)

data class FamilyLink(val id: String, val status: String)

private const val API_V1 = "${BuildConfig.API_BASE_URL}/api/v1"

/**
 * Minimal HTTP client over the Android built-ins. Reuses the exact shapes
 * verified against the backend while building the guardian app:
 *  - firebase-login: POST /auth/firebase-login      -> { token, user }
 *  - accept:         POST /family-links/accept      -> FamilyLink (status active)
 */
object ApiClient {

    fun firebaseLoginAsElder(idToken: String): LoginResult {
        val payload = JSONObject()
            .put("role", "elder")
            .put("id_token", idToken)
        val body = request("POST", "/auth/firebase-login", payload.toString())
        return LoginResult(
            token = body.getString("token"),
            user = body.getJSONObject("user").let {
                LoggedInUser(it.getString("id"), it.getString("phone_number_hash"))
            },
        )
    }

    fun acceptInvite(token: String, inviteCode: String): FamilyLink {
        val payload = JSONObject().put("invite_code", inviteCode.trim())
        val body = request("POST", "/family-links/accept", payload.toString(), token)
        return FamilyLink(id = body.getString("id"), status = body.getString("status"))
    }

    /**
     * Elder-initiated report of a suspicious call. Only the hashed number
     * leaves the device — the raw number never does. Risk data is unknown by
     * design: the elder's judgement IS the signal in this milestone.
     */
    fun reportSuspiciousCall(token: String, number: String) {
        postEvent(
            token,
            eventType = "call",
            senderHash = sha256Hex(number),
            riskScore = null,
            reasons = listOf("reported_by_elder"),
        )
    }

    data class ScanResult(val identifierHash: String, val score: Double?, val source: String)

    /** Checks a URL's reputation. Score is null when no vendor is configured. */
    fun scanUrl(token: String, url: String): ScanResult {
        val payload = JSONObject().put("url", url.trim())
        val body = request("POST", "/detection/scan-url", payload.toString(), token)
        return ScanResult(
            identifierHash = body.getString("identifier_hash"),
            score = if (body.isNull("score")) null else body.getDouble("score"),
            source = body.getString("source"),
        )
    }

    /** Flags an event (already-hashed sender) — drives the guardian push. */
    private fun postEvent(
        token: String,
        eventType: String,
        senderHash: String,
        riskScore: Double?,
        reasons: List<String>,
    ) {
        val payload = JSONObject()
            .put("event_type", eventType)
            .put("sender_hash", senderHash)
            .put("risk_score", riskScore ?: JSONObject.NULL)
            .put("risk_reasons", JSONArray(reasons))
        request("POST", "/events", payload.toString(), token)
    }

    /** Shares a scan result that came back clearly dangerous with the guardian. */
    fun postLinkFlag(token: String, urlHash: String, score: Double) {
        postEvent(token, "link", urlHash, score, listOf("url_scan_dangerous"))
    }

    /** SHA-256 hex digest — used for call numbers before they leave the device. */
    private fun sha256Hex(input: String): String {
        val bytes = java.security.MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray(StandardCharsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun request(
        method: String,
        path: String,
        payload: String? = null,
        token: String? = null,
    ): JSONObject {
        val connection = URL(API_V1 + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            if (token != null) {
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            if (payload != null) {
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8)
                    .use { it.write(payload) }
            }

            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(StandardCharsets.UTF_8)
                ?.use { it.readText() }
                .orEmpty()

            val body = if (text.isBlank()) JSONObject() else JSONObject(text)
            if (status !in 200..299) {
                throw ApiError(
                    status,
                    body.optString("code", "UNKNOWN"),
                    body.optString("error", "Request failed"),
                )
            }
            return body
        } finally {
            connection.disconnect()
        }
    }
}