package com.myguardian.elder.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.myguardian.elder.data.ApiClient
import com.myguardian.elder.data.CapturedCallsStore
import com.myguardian.elder.data.TokenStore
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import android.text.format.DateUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Recent calls captured by MyGuardian's call screening, newest first. Nothing
 * is sent anywhere until the elder taps "Report" — then the call's number is
 * hashed on-device and shared with the guardian as a flagged event.
 */
@Composable
fun RecentCallsScreen(store: TokenStore) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val callsStore = CapturedCallsStore(context)
    val scope = rememberCoroutineScope()

    val calls = remember { callsStore.all().toMutableStateList() }
    var reportedKeys by remember { mutableStateOf(callsStore.let { s -> s.all().filter(s::isReported).map(s::keyOf) }.toSet()) }
    var busyKey by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    ElderScreen {
        Text(
            "Recent calls",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Calls that came in while MyGuardian was switched on. If one felt " +
                "wrong — a stranger pushing you to act — report it and your " +
                "guardian will know straight away. Calls are never recorded.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))

        if (calls.isEmpty()) {
            Text(
                "No calls yet. When someone calls, they'll show up here.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            // Plain column: the list is capped at 20 entries and lives inside
            // the screen's own scroll container.
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                calls.forEach { call ->
                    val key = "${call.number}|${call.at}"
                    val reported = key in reportedKeys
                    androidx.compose.material3.Card(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                        ) {
                            Text(
                                call.number,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onBackground,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                DateUtils.getRelativeTimeSpanString(
                                    call.at,
                                    System.currentTimeMillis(),
                                    DateUtils.MINUTE_IN_MILLIS,
                                ).toString(),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(10.dp))
                            when {
                                reported -> Text(
                                    "Guardian notified ✓",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                else -> BigButton(
                                    text = if (busyKey == key) "Sending…" else "Report as suspicious",
                                    onClick = {
                                        if (busyKey != null) return@BigButton
                                        busyKey = key
                                        error = null
                                        scope.launch(Dispatchers.IO) {
                                            try {
                                                com.myguardian.elder.data.SessionRefresher
                                                    .withFreshSession(store) { token ->
                                                        ApiClient.reportSuspiciousCall(token, call.number)
                                                    }
                                                withContext(Dispatchers.Main) {
                                                    callsStore.markReported(call)
                                                    reportedKeys = reportedKeys + key
                                                    busyKey = null
                                                }
                                            } catch (e: com.myguardian.elder.data.ApiError) {
                                                withContext(Dispatchers.Main) {
                                                    error =
                                                        "Couldn't send the report. Please try again."
                                                    busyKey = null
                                                }
                                            } catch (e: Exception) {
                                                withContext(Dispatchers.Main) {
                                                    error = "Couldn't reach MyGuardian. " +
                                                        "Check your connection and try again."
                                                    busyKey = null
                                                }
                                            }
                                        }
                                    },
                                    enabled = busyKey == null || busyKey == key,
                                )
                            }
                        }
                    }
                }
            }
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