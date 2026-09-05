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
import androidx.compose.runtime.LaunchedEffect
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
import com.myguardian.elder.data.TokenStore
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Link checker. The elder shares or pastes a link they're unsure about; the
 * backend checks its reputation and the verdict is shown in plain language.
 * A clearly dangerous result is shared with the guardian automatically (the
 * elder's deliberate check IS the intent to involve them); unknown/safe
 * results stay on the device.
 */
private const val DANGEROUS_SCORE = 75.0

@Composable
fun CheckLinkScreen(store: TokenStore, initialUrl: String?) {
    val scope = rememberCoroutineScope()

    var url by rememberSaveable { mutableStateOf(initialUrl ?: "") }
    var checking by rememberSaveable { mutableStateOf(false) }
    var checked by rememberSaveable { mutableStateOf(false) }
    var score by rememberSaveable { mutableStateOf<Double?>(null) }
    var flagged by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    val check: () -> Unit = {
        val trimmed = url.trim()
        if (!trimmed.contains("://")) {
            error = "Please enter the full link, starting with http:// or https://"
        } else if (!checking) {
            checking = true
            error = null
            scope.launch(Dispatchers.IO) {
                try {
                    var didFlag = false
                    val result = com.myguardian.elder.data.SessionRefresher.withFreshSession(store) { token ->
                        val r = ApiClient.scanUrl(token, trimmed)
                        if ((r.score ?: 0.0) >= DANGEROUS_SCORE) {
                            ApiClient.postLinkFlag(token, r.identifierHash, r.score!!)
                            didFlag = true
                        }
                        r
                    }
                    withContext(Dispatchers.Main) {
                        score = result.score
                        flagged = didFlag
                        checked = true
                    }
                } catch (e: ApiError) {
                    withContext(Dispatchers.Main) {
                        error = when (e.code) {
                            "NO_SESSION" -> "Please connect with your guardian first."
                            else -> "The check didn't go through. Please try again."
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        error = "Couldn't reach MyGuardian. Check your connection " +
                            "and try again."
                    }
                } finally {
                    withContext(Dispatchers.Main) { checking = false }
                }
            }
        }
    }

    // Arriving via share sheet: run the check immediately.
    LaunchedEffect(initialUrl) {
        if (!initialUrl.isNullOrBlank()) check()
    }

    ElderScreen {
        Text(
            "Check a link",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Not sure about a link someone sent you? Share it to MyGuardian " +
                "or paste it here, and we'll take a look.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
            label = { Text("Link to check") },
            singleLine = true,
            enabled = !checking,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Uri,
                capitalization = KeyboardCapitalization.None,
            ),
            textStyle = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(12.dp))
        BigButton(
            text = if (checking) "Checking…" else "Check this link",
            onClick = check,
            enabled = !checking && url.isNotBlank(),
            loading = checking,
        )

        if (checked && error == null) {
            Spacer(Modifier.height(20.dp))
            val (title, body, color) = when {
                score == null -> Triple(
                    "We couldn't verify this link",
                    "Our checkers couldn't reach a clear verdict. Be careful — " +
                        "don't enter passwords or payment details.",
                    MaterialTheme.colorScheme.onSurfaceVariant,
                )
                score!! >= DANGEROUS_SCORE -> Triple(
                    "This link looks dangerous!",
                    if (flagged) {
                        "Don't open it and don't share your details. " +
                            "Your guardian has been notified."
                    } else {
                        "Don't open it and don't share your details."
                    },
                    MaterialTheme.colorScheme.error,
                )
                score!! >= 50.0 -> Triple(
                    "Be careful with this link",
                    "It looks suspicious. Don't enter personal details unless " +
                        "you're sure it's genuine.",
                    MaterialTheme.colorScheme.tertiary,
                )
                else -> Triple(
                    "This link looks safe so far",
                    "No problems were found — but stay alert if it asks for " +
                        "money or passwords.",
                    MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                color = color,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
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