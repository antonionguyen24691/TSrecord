# Hướng dẫn build app (Android + iOS)

App này là **Capacitor** (web React/Vite đóng gói vào WebView native). Mọi thay đổi
code TS/React phải `build` lại rồi `cap sync` thì native mới nhận.

## 0. Chuẩn bị chung (mỗi lần đổi code)

```bash
npm install            # lần đầu
npm run build          # tsc --noEmit && vite build  -> dist/
npx cap sync android   # copy dist + cập nhật plugin vào android/
npx cap sync ios       # tương tự cho ios/ (chỉ chạy được trên macOS vì cần pod install)
```

> Có sẵn script gộp: `npm run android:sync`, `npm run ios:sync`, `npm run native:sync`.

---

## 1. Android

**Yêu cầu:** Android Studio (kèm JDK 21) + Android SDK. Máy này đã có SDK ở
`C:\Users\DELL\AppData\Local\Android\Sdk` và JDK tại `C:\Program Files\Android\Android Studio\jbr`.

### Build APK debug (để test nhanh trên máy)

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleDebug
```

APK ra ở: `android/app/build/outputs/apk/debug/app-debug.apk` — cài bằng
`adb install -r <đường-dẫn>.apk` hoặc copy sang điện thoại.

Hoặc mở bằng Android Studio: `npx cap open android` rồi bấm Run.

### Build bản RELEASE để lên Play Store (AAB đã ký)

1. **Tạo keystore một lần** (giữ file này thật kỹ — mất là không update app được):
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" `
     -genkey -v -keystore tsrecord-release.keystore `
     -alias tsrecord -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Tạo `android/key.properties`** từ mẫu `android/key.properties.example`, điền
   đường dẫn keystore + mật khẩu. File này ĐÃ được gitignore, KHÔNG commit.
3. **Build AAB:**
   ```powershell
   $env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
   cd android
   .\gradlew.bat bundleRelease
   ```
   Kết quả: `android/app/build/outputs/bundle/release/app-release.aab` → upload lên
   Play Console. (Muốn APK ký thì dùng `assembleRelease`.)

> Mỗi lần phát hành nhớ tăng `versionCode` và `versionName` trong
> [android/app/build.gradle](android/app/build.gradle).

### Việc còn phải làm trước khi lên Play (xem rà soát production)
- Gỡ permission `REQUEST_INSTALL_PACKAGES` trong `AndroidManifest.xml` (vi phạm policy
  Play; chỉ dùng cho sideload), chuyển sang Play in-app update.
- Đặt `android:allowBackup="false"` để không backup dữ liệu nhạy cảm.

---

## 2. iOS

> ⚠️ **Bắt buộc máy macOS + Xcode.** Không build được iOS trên Windows. Trên Windows
> chỉ có thể `npx cap copy ios` để đồng bộ web assets; phần đóng gói phải làm trên Mac.

Trên máy Mac (sau khi clone repo + `npm install`):

```bash
npm run build
npx cap sync ios        # cần CocoaPods: sudo gem install cocoapods
npx cap open ios        # mở Xcode
```

Trong Xcode:
1. Chọn target **App** → tab **Signing & Capabilities** → chọn Team (Apple Developer
   account, $99/năm) → Xcode tự tạo provisioning profile.
2. Chọn scheme **App**, thiết bị **Any iOS Device**.
3. **Product → Archive** → Organizer → **Distribute App** → App Store Connect để
   nộp lên TestFlight / App Store.

Cần khai báo quyền micro trong `ios/App/App/Info.plist` (`NSMicrophoneUsageDescription`)
— kiểm tra đã có trước khi nộp.

---

## 3. Lưu ý chung
- Backend (`admin-backend/`) deploy riêng (Vercel) — xem `vps_deployment_guide.md`.
- Biến `VITE_BACKEND_URL` phải trỏ tới backend production khi build app phát hành.
