package com.myguardian.elder

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.myguardian.elder.data.TokenStore
import com.myguardian.elder.theme.MyGuardianTheme
import com.myguardian.elder.ui.MyGuardianApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val store = TokenStore(this)
        val openRecentCalls = intent?.getStringExtra(EXTRA_OPEN) == OPEN_CALLS
        val sharedUrl = extractUrl(intent?.getStringExtra(Intent.EXTRA_TEXT))
        setContent {
            MyGuardianTheme {
                MyGuardianApp(
                    store = store,
                    openRecentCalls = openRecentCalls,
                    initialCheckUrl = sharedUrl,
                )
            }
        }
    }

    companion object {
        /** Intent extra set by the "recent call" notification's tap action. */
        const val EXTRA_OPEN = "open"
        const val OPEN_CALLS = "calls"

        /** First http(s) URL inside a shared blob of text, if any. */
        fun extractUrl(text: String?): String? =
            text?.split(Regex("\\s+"))
                ?.firstOrNull { it.startsWith("http://") || it.startsWith("https://") }
    }
}