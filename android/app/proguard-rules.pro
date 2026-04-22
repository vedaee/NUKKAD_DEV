# React Native
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.**

# Google Play services
-keep class com.google.android.gms.** { *; }

# Keep annotations
-keepattributes *Annotation*

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Parcelable
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Kotlin
-keep class kotlin.Metadata { *; }

# Notifee
-keep class app.notifee.** { *; }

# Classes with @Keep
-keep @androidx.annotation.Keep class * { *; }
