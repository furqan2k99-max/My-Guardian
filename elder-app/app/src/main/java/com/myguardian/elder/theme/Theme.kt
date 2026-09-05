package com.myguardian.elder.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Primary audience is elderly: dark, high-contrast ink on white, generous type.
val Ink = Color(0xFF111827)
val MutedInk = Color(0xFF374151) // readable secondary — not the washed-out M3 grey
val Paper = Color(0xFFFFFFFF)
val SurfaceTone = Color(0xFFF3F4F6)
val Accent = Color(0xFF1D4ED8)   // dark blue: white-on-accent passes ~7:1 contrast
val AccentDark = Color(0xFF1E40AF)
val Hairline = Color(0xFFD1D5DB)
val ErrorRed = Color(0xFFB91C1C)

private val ElderColors = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDBEAFE),
    onPrimaryContainer = Ink,
    background = Paper,
    onBackground = Ink,
    surface = SurfaceTone,
    onSurface = Ink,
    surfaceVariant = SurfaceTone,
    onSurfaceVariant = MutedInk,
    error = ErrorRed,
    onError = Color.White,
    outline = Hairline,
)

private val ElderTypography = Typography(
    headlineLarge = TextStyle(
        fontSize = 36.sp, fontWeight = FontWeight.Bold, lineHeight = 44.sp,
    ),
    headlineMedium = TextStyle(
        fontSize = 32.sp, fontWeight = FontWeight.Bold, lineHeight = 40.sp,
    ),
    titleLarge = TextStyle(
        fontSize = 24.sp, fontWeight = FontWeight.SemiBold, lineHeight = 32.sp,
    ),
    bodyLarge = TextStyle(
        fontSize = 20.sp, fontWeight = FontWeight.Normal, lineHeight = 28.sp,
    ),
    bodyMedium = TextStyle(
        fontSize = 18.sp, fontWeight = FontWeight.Normal, lineHeight = 26.sp,
    ),
    labelLarge = TextStyle(
        fontSize = 20.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.sp,
    ),
    labelMedium = TextStyle(
        fontSize = 18.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.sp,
    ),
    titleMedium = TextStyle(
        fontSize = 22.sp, fontWeight = FontWeight.SemiBold, lineHeight = 30.sp,
    ),
)

@Composable
fun MyGuardianTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ElderColors,
        typography = ElderTypography,
        content = content,
    )
}