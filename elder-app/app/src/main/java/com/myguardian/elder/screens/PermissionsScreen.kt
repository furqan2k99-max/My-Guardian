package com.myguardian.elder.screens

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import com.myguardian.elder.ui.InfoPanel

/**
 * Explains WHY each permission may be asked, and requests call access through
 * the standard Android runtime flow (system dialog). Once granted, guides the
 * user to make MyGuardian their call screening app — opening the system
 * settings screen when available, or showing plain-language manual
 * instructions when that screen can't be opened (e.g. on the test emulator).
 * Text messages are NOT protected in this version — the screen says so
 * explicitly rather than implying a capability the app doesn't have.
 */
@Composable
fun PermissionsScreen(onContinue: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var callAccessGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var isScreeningApp by remember { mutableStateOf(isDefaultCallScreeningApp(context)) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                callAccessGranted =
                    ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) ==
                        PackageManager.PERMISSION_GRANTED
                isScreeningApp = isDefaultCallScreeningApp(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val callPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        callAccessGranted = granted
    }

    ElderScreen {
        Text(
            "About permissions",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "When the safety helpers turn on, MyGuardian may ask to use a few " +
                "things on your phone. Here's what they're for.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))

        InfoPanel(
            title = "Phone calls",
            body = "Lets MyGuardian list your incoming calls so you can report " +
                "the ones that feel wrong. Calls are never blocked, recorded, " +
                "or listened to.",
        )
        Spacer(Modifier.height(12.dp))
        InfoPanel(
            title = "Text messages",
            body = "Not covered yet — MyGuardian doesn't read your text messages " +
                "in this version. It checks links and helps you report calls " +
                "instead, and your messages stay fully private.",
        )
        Spacer(Modifier.height(12.dp))
        InfoPanel(
            title = "Notifications",
            body = "So a friendly, clear alert can be shown when something " +
                "needs your attention.",
        )
        Spacer(Modifier.height(20.dp))

        Text(
            if (callAccessGranted) "Call access granted ✓" else "Call access not granted yet",
            style = MaterialTheme.typography.bodyMedium,
            color = if (callAccessGranted) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        BigButton(
            text = if (callAccessGranted) "Call access granted" else "Allow call access",
            onClick = { callPermissionLauncher.launch(Manifest.permission.CALL_PHONE) },
            enabled = !callAccessGranted,
        )

        if (callAccessGranted) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Call screening",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            when {
                isScreeningApp -> {
                    Text(
                        "MyGuardian is your call screening app ✓",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                canOpenCallScreeningSettings(context) -> {
                    Text(
                        "One more step — choose MyGuardian as your call screening " +
                            "app so it can watch incoming calls.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    BigButton(
                        text = "Open call screening settings",
                        onClick = { openCallScreeningSettings(context) },
                    )
                }
                else -> {
                    Text(
                        "One more step — choose MyGuardian as your call screening " +
                            "app. Your phone can't open that screen from here, so go to " +
                            "Settings > Apps > Default apps > Caller ID & spam apps, " +
                            "and choose MyGuardian.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        Spacer(Modifier.height(24.dp))
        Text(
            "You'll be asked one at a time, when it's actually needed — " +
                "and you can change your mind at any time in your phone's Settings.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(24.dp))
        BigButton("Continue", onContinue)
    }
}

/** True when the system has a screen for choosing the call screening app. */
private fun canOpenCallScreeningSettings(context: Context): Boolean {
    val intent = Intent("android.settings.CALL_SCREENING_SETTINGS")
    return intent.resolveActivity(context.packageManager) != null
}

private fun openCallScreeningSettings(context: Context) {
    context.startActivity(Intent("android.settings.CALL_SCREENING_SETTINGS"))
}

/** True once MyGuardian holds the system's call-screening-app role. */
private fun isDefaultCallScreeningApp(context: Context): Boolean {
    val roleManager = context.getSystemService(RoleManager::class.java) ?: return false
    return roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
}