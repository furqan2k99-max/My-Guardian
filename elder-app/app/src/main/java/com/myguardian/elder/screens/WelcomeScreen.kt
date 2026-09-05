package com.myguardian.elder.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.myguardian.elder.ui.BigButton
import com.myguardian.elder.ui.ElderScreen
import com.myguardian.elder.ui.InfoPanel

@Composable
fun WelcomeScreen(onContinue: () -> Unit) {
    ElderScreen {
        Text(
            "Welcome to MyGuardian",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "MyGuardian helps you and a trusted family member spot scams " +
                "together. When a call or a link feels wrong, tell MyGuardian — " +
                "it checks what it can and lets your guardian know right away. " +
                "Your private messages stay private.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        InfoPanel(
            title = "Getting started",
            body = "First, connect with your guardian. After that you can check " +
                "a link before trusting it, and report any call that felt wrong.",
        )
        Spacer(Modifier.height(28.dp))
        BigButton("Let's get started", onContinue)
    }
}