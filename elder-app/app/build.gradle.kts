plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.myguardian.elder"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.myguardian.elder"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Backend base URL. Override per machine via MYGUARDIAN_API_URL
        // (env var, -P flag, or gradle.properties) — NOT a secret, it ships in the app.
        val apiUrl = (System.getenv("MYGUARDIAN_API_URL")
            ?: project.findProperty("MYGUARDIAN_API_URL") as String?
            ?: "http://10.0.2.2:4000")
        buildConfigField("String", "API_BASE_URL", "\"$apiUrl\"")
    }

    signingConfigs {
        val storeFile = project.findProperty("MYGUARDIAN_RELEASE_STORE_FILE") as String?
        if (storeFile != null) {
            create("release") {
                this.storeFile = file(storeFile)
                storePassword =
                    project.findProperty("MYGUARDIAN_RELEASE_STORE_PASSWORD") as String
                keyAlias =
                    project.findProperty("MYGUARDIAN_RELEASE_KEY_ALIAS") as String
                keyPassword =
                    project.findProperty("MYGUARDIAN_RELEASE_KEY_PASSWORD") as String
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
}