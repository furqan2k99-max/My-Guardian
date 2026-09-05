package com.myguardian.elder.data

import com.google.firebase.auth.FirebaseAuth

/**
 * Keeps the elder's MyGuardian session working across access-token expiry.
 * The backend session JWT lives for a day; when a call is rejected as
 * INVALID_TOKEN, a fresh Firebase ID token (the Firebase account stays signed
 * in) is exchanged for a new session transparently — one retry, no prompts.
 */
object SessionRefresher {

    suspend fun <T> withFreshSession(store: TokenStore, block: (String) -> T): T {
        val token = store.token
            ?: throw EmailAuthHelper.EmailAuthException(
                "NO_SESSION",
                "Please connect with your guardian first.",
            )
        return try {
            block(token)
        } catch (e: ApiError) {
            if (e.status != 401) throw e
            val fresh = refresh()
            store.saveSession(fresh)
            block(fresh)
        }
    }

    /** Exchanges a forced-refresh Firebase token for a new backend session. */
    suspend fun refresh(): String {
        val firebaseUser = FirebaseAuth.getInstance().currentUser
            ?: throw EmailAuthHelper.EmailAuthException(
                "NO_SESSION",
                "Please connect with your guardian again.",
            )
        val idToken = firebaseUser.getIdToken(true).await().token
            ?: throw EmailAuthHelper.EmailAuthException(
                "UNKNOWN",
                "Couldn't renew the sign-in.",
            )
        return ApiClient.firebaseLoginAsElder(idToken).token
    }
}