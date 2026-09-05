package com.myguardian.elder.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.myguardian.elder.data.TokenStore
import com.myguardian.elder.screens.CheckLinkScreen
import com.myguardian.elder.screens.DoneScreen
import com.myguardian.elder.screens.PairScreen
import com.myguardian.elder.screens.PermissionsScreen
import com.myguardian.elder.screens.RecentCallsScreen
import com.myguardian.elder.screens.WelcomeScreen

private object Routes {
    const val WELCOME = "welcome"
    const val PERMISSIONS = "permissions"
    const val PAIR = "pair"
    const val DONE = "done"
    const val CALLS = "calls"
    const val CHECK_LINK = "check_link"
}

/**
 * Onboarding flow: welcome -> permissions (explain only) -> pair -> done.
 * Cold start after a successful pair lands on the done screen — unless the
 * app was opened from a "recent call" notification (jumps to recent calls)
 * or a shared link from the share sheet (jumps to the link checker).
 */
@Composable
fun MyGuardianApp(
    store: TokenStore,
    openRecentCalls: Boolean,
    initialCheckUrl: String?,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val start = when {
        store.isPaired && !initialCheckUrl.isNullOrBlank() -> Routes.CHECK_LINK
        store.isPaired && openRecentCalls -> Routes.CALLS
        store.isPaired -> Routes.DONE
        else -> Routes.WELCOME
    }

    NavHost(navController = navController, startDestination = start, modifier = modifier) {
        composable(Routes.WELCOME) {
            WelcomeScreen(onContinue = { navController.navigate(Routes.PERMISSIONS) })
        }
        composable(Routes.PERMISSIONS) {
            PermissionsScreen(onContinue = { navController.navigate(Routes.PAIR) })
        }
        composable(Routes.PAIR) {
            PairScreen(
                store = store,
                onPaired = {
                    navController.navigate(Routes.DONE) {
                        // Drop the onboarding stack so back doesn't return to pair.
                        popUpTo(Routes.WELCOME) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.DONE) {
            DoneScreen(
                onOpenCalls = { navController.navigate(Routes.CALLS) },
                onOpenCheckLink = { navController.navigate(Routes.CHECK_LINK) },
                onStartOver = {
                    store.clearSession()
                    navController.navigate(Routes.WELCOME) {
                        popUpTo(Routes.DONE) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.CALLS) {
            RecentCallsScreen(store = store)
        }
        composable(Routes.CHECK_LINK) {
            CheckLinkScreen(store = store, initialUrl = initialCheckUrl)
        }
    }
}