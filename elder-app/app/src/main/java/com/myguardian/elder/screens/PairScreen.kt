package com.myguardian.elder.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.myguardian.elder.data.ApiClient
import com.myguardian.elder.data.ApiError
import com.myguardian.elder.data.EmailAuthHelper
import com.myguardian.elder.data.TokenStore
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Step 3 — pairing. The elder signs in (or is signed up transparently on
 * first use) with email + password BEFORE entering the guardian's invite code:
 *   1. email + password -> Firebase ID token (verified account session)
 *   2. invite code      -> POST /auth/firebase-login (id_token) -> token
 *                          POST /family-links/accept            -> active link
 */
@Composable
fun PairScreen(store: TokenStore, onPaired: () -> Unit) {
    val scope = rememberCoroutineScope()

    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var firebaseToken by rememberSaveable { mutableStateOf<String?>(null) }
    var code by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    val signIn: () -> Unit = {
        if (!email.contains("@")) {
            error = "Please enter your full email address."
        } else if (password.isBlank()) {
            error = "Please choose a password."
        } else if (!busy) {
            busy = true
            error = null
            scope.launch(Dispatchers.IO) {
                try {
                    val token = EmailAuthHelper.signInOrSignUp(email, password)
                    withContext(Dispatchers.Main) {
                        firebaseToken = token
                        error = null
                    }
                } catch (e: EmailAuthHelper.EmailAuthException) {
                    withContext(Dispatchers.Main) {
                        error = e.message
                    }
                } finally {
                    withContext(Dispatchers.Main) { busy = false }
                }
            }
        }
    }

    val connect: () -> Unit = {
        val token = firebaseToken
        val trimmedCode = code.trim()
        if (token == null) {
            error = "Sign in with your email first."
        } else if (trimmedCode.isEmpty()) {
            error = "Please enter the invite code your guardian shared with you."
        } else if (!busy) {
            busy = true
            error = null
            scope.launch(Dispatchers.IO) {
                try {
                    val login = ApiClient.firebaseLoginAsElder(token)
                    val link = ApiClient.acceptInvite(login.token, trimmedCode)
                    withContext(Dispatchers.Main) {
                        if (link.status == "active") {
                            store.saveSession(login.token)
                            onPaired()
                        } else {
                            error = "Something went wrong while connecting. Please try again."
                            busy = false
                        }
                    }
                } catch (e: ApiError) {
                    withContext(Dispatchers.Main) {
                        error = when (e.code) {
                            "INVALID_INVITE_CODE" ->
                                "That code didn't work. Double-check it, or ask your " +
                                    "guardian for a fresh one."
                            "INVALID_TOKEN" ->
                                "Your sign-in expired. Go back and sign in again."
                            else ->
                                "Something went wrong while connecting. Please try again."
                        }
                        busy = false
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        error = "Couldn't reach MyGuardian. Check your connection " +
                            "and try again."
                        busy = false
                    }
                }
            }
        }
    }

    ElderScreen {
        Text(
            "Connect with your guardian",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Two simple steps: create your account with your email, then enter " +
                "the invite code your guardian shared with you.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
            label = { Text("1. Your email") },
            singleLine = true,
            enabled = !busy && firebaseToken == null,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                capitalization = KeyboardCapitalization.None,
            ),
            textStyle = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
            label = { Text("Your password") },
            singleLine = true,
            enabled = !busy && firebaseToken == null,
            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            textStyle = MaterialTheme.typography.bodyLarge,
        )
        if (firebaseToken == null) {
            Spacer(Modifier.height(8.dp))
            Text(
                "New here? Just pick a password you'll remember — we'll create " +
                    "your account automatically.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            BigButton(
                text = "Continue",
                onClick = signIn,
                enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                loading = busy && firebaseToken == null,
            )
        }

        if (firebaseToken != null) {
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.filter { c -> c.isLetterOrDigit() }.uppercase() },
                modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                label = { Text("2. Your guardian's invite code") },
                singleLine = true,
                enabled = !busy,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Ascii,
                    capitalization = KeyboardCapitalization.None,
                ),
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                ),
            )
            Spacer(Modifier.height(12.dp))
            Text(
                "It's a short 6-character code and only works for 15 minutes — " +
                    "ask your guardian for a fresh one if it's too old.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            BigButton(
                text = "Connect",
                onClick = connect,
                enabled = !busy && code.isNotBlank(),
                loading = busy && code.isNotBlank(),
            )
        }

        error?.let { message ->
            Spacer(Modifier.height(12.dp))
            Text(
                message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}