# Capacitor + custom plugins
-keep class com.getcapacitor.** { *; }
-keep class com.trichxuatamthanh.app.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Keep line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# WebView JavaScript bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
