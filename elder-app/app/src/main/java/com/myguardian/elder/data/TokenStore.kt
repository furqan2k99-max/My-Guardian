package com.myguardian.elder.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Session storage backed by EncryptedSharedPreferences (Keystore-held master
 * key): the access token and pairing flag are no longer readable from a
 * plain prefs file. Migrates transparently from the legacy plaintext store
 * and self-heals if the keyset is ever corrupted (session is simply cleared).
 */
class TokenStore(context: Context) {

    private val prefs: SharedPreferences = createSecurePrefs(context)

    init {
        migrateLegacyPlaintext(context)
    }

    val isPaired: Boolean
        get() = prefs.getBoolean(KEY_PAIRED, false)

    val token: String?
        get() = prefs.getString(KEY_TOKEN, null)

    fun saveSession(token: String) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putBoolean(KEY_PAIRED, true)
            .apply()
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    private fun createSecurePrefs(context: Context): SharedPreferences {
        return try {
            build(context)
        } catch (e: Exception) {
            // Unreadable keyset (corruption, backup-restore onto a new device):
            // the old ciphertext can never decrypt, so reset and start clean.
            context.deleteSharedPreferences(FILE_NAME)
            build(context)
        }
    }

    private fun build(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    /** One-time carry-over from the old plaintext file, then it is deleted. */
    private fun migrateLegacyPlaintext(context: Context) {
        val legacy = context.getSharedPreferences(LEGACY_FILE_NAME, Context.MODE_PRIVATE)
        val legacyToken = legacy.getString(KEY_TOKEN, null)
        val legacyPaired = legacy.getBoolean(KEY_PAIRED, false)
        if (legacyToken != null || legacyPaired) {
            if (token == null && !isPaired) {
                saveSession(legacyToken ?: return)
            }
            legacy.edit().clear().apply()
            context.deleteSharedPreferences(LEGACY_FILE_NAME)
        }
    }

    private companion object {
        const val FILE_NAME = "myguardian_elder_secure"
        const val LEGACY_FILE_NAME = "myguardian_elder"
        const val KEY_TOKEN = "access_token"
        const val KEY_PAIRED = "paired"
    }
}