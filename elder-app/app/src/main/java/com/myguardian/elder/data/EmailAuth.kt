package com.myguardian.elder.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Thin, suspend-friendly wrapper over Firebase email/password auth. Signs in
 * to an existing account, creating one transparently on first use; either way
 * the caller gets a Firebase ID token that the backend verifies on
 * /auth/firebase-login (never a client-supplied identity).
 */
object EmailAuthHelper {

    class EmailAuthException(val code: String, message: String) : Exception(message)

    /** Signs in — or, when the account doesn't exist yet, creates it. */
    suspend fun signInOrSignUp(email: String, password: String): String {
        val auth = FirebaseAuth.getInstance()
        return try {
            idTokenAfter { auth.signInWithEmailAndPassword(email.trim(), password).await() }
        } catch (e: Exception) {
            // Firebase's email enumeration protection hides whether the account
            // exists (failed sign-ins look like wrong passwords), so any failed
            // sign-in falls through to a signup attempt. An existing account
            // then surfaces as EMAIL_EXISTS below.
            try {
                idTokenAfter { auth.createUserWithEmailAndPassword(email.trim(), password).await() }
            } catch (e2: Exception) {
                if (e2 is FirebaseAuthUserCollisionException) {
                    throw EmailAuthException(
                        "INVALID_CREDENTIALS",
                        "Email or password didn\u2019t match an account.",
                    )
                }
                throw toAuthError(e2)
            }
        }
    }

    private suspend fun idTokenAfter(signIn: suspend () -> com.google.firebase.auth.AuthResult): String {
        val result = signIn()
        val token = result.user?.getIdToken(false)?.await()?.token
        // The Firebase session is deliberately kept alive so an expired
        // MyGuardian token can be silently refreshed later (see
        // SessionRefresher). No need to stay signed in twice.
        return token ?: throw EmailAuthException("UNKNOWN", "Sign-in returned no user session")
    }

    private fun toAuthError(e: Throwable): EmailAuthException = when (e) {
        is FirebaseAuthWeakPasswordException ->
            EmailAuthException(
                "WEAK_PASSWORD",
                "Please choose a stronger password (at least 6 characters).",
            )
        is FirebaseAuthInvalidCredentialsException ->
            EmailAuthException(
                "INVALID_CREDENTIALS",
                "Email or password didn\u2019t match an account.",
            )
        is FirebaseAuthUserCollisionException ->
            EmailAuthException(
                "EMAIL_IN_USE",
                "That email already has an account \u2014 check your password.",
            )
        else ->
            EmailAuthException(
                "EMAIL_AUTH_FAILED",
                e.message ?: "Couldn\u2019t sign you in right now. Please try again.",
            )
    }
}