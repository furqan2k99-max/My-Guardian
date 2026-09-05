package com.myguardian.elder.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import com.myguardian.elder.ui.InfoPanel
import com.myguardian.elder.ui.TextButton

/**
 * Post-pairing home screen. Entry point for the recent-calls report screen,
 * plus the POST_NOTIFICATIONS opt-in so "recent call" nudges can appear.
 */
@Composable
fun DoneScreen(
    onOpenCalls: () -> Unit,
    onOpenCheckLink: () -> Unit,
    onStartOver: () -> Unit,
) {
    val context = LocalContext.current

    val notificationsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* state re-reads on recomposition via the granted check below */ }

    ElderScreen {
        Text(
            "You're all set!",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "You're connected with your guardian. " +
                "MyGuardian is switched on and will take good care of you.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        InfoPanel(
            title = "What you can do",
            body = "Anytime, with one tap: check whether a link is safe before " +
                "trusting it, and report a call that felt wrong so your " +
                "guardian knows. MyGuardian never blocks calls or reads your " +
                "messages.",
        )
        Spacer(Modifier.height(24.dp))

        BigButton("Check a link", onOpenCheckLink)
        Spacer(Modifier.height(12.dp))
        BigButton("See recent calls", onOpenCalls)
        Spacer(Modifier.height(12.dp))

        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED || android.os.Build.VERSION.SDK_INT < 33

        if (granted) {
            Text(
                "Call reminders are on ✓",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            TextButton(
                "Turn on call reminders",
                onClick = { notificationsLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) },
            )
        }

        Spacer(Modifier.height(28.dp))
        TextButton("Not you? Start over", onStartOver)
    }
}