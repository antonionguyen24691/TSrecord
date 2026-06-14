# Roadmap nâng cấp TSrecord — Admin & tối ưu chi phí

> Cập nhật: 14/06/2026 · App v1.4.6 · Tài liệu cấu hình chi tiết: [HUONG-DAN-CAU-HINH-ADMIN-TSrecord.docx](./HUONG-DAN-CAU-HINH-ADMIN-TSrecord.docx)

Trạng thái: ✅ xong · 🚧 đang/kế tiếp · ⏳ chưa làm

---

## ✅ 1. Ưu tiên key FREE trong pool (giảm chi phí) — ĐÃ LÀM

Mục tiêu: luôn vắt hết hạn mức **key free** trước khi đụng tới **key trả phí**.

**Đã thực hiện:**
- Thêm cột `tier` vào `provider_keys_v2` (`0` = free, `1` = trả phí), kèm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` để nâng cấp DB cũ an toàn + index mới `provider_keys_v2_pick_tier_idx`.
  → [admin-backend/src/platform/schema.ts](../admin-backend/src/platform/schema.ts)
- Đổi thứ tự chọn key thành `ORDER BY tier ASC, last_used_at ASC, sort_order ASC` — free trước, trong cùng hạng vẫn xoay vòng (LRU).
  → [admin-backend/src/platform/providerKeys.ts](../admin-backend/src/platform/providerKeys.ts)
- API admin nhận/chỉnh `tier` khi thêm & sửa key.
  → [admin-backend/src/routes/platform.ts](../admin-backend/src/routes/platform.ts)
- Admin UI: badge FREE/Trả phí, đếm free/paid mỗi provider, nút đổi hạng nhanh, chọn hạng khi thêm key, ghi chú tối ưu chi phí.
  → [admin-backend/public/admin.js](../admin-backend/public/admin.js)

**Cách dùng:** nạp nhiều key FREE (Gemini, Groq) hạng FREE; thêm key OpenAI/AssemblyAI ở hạng **Trả phí** để chỉ chạy khi free cạn.

---

## 🚧 2. Thứ tự provider "rẻ trước" ở server

Khi client không chỉ định provider, backend tự chọn theo thứ tự rẻ nhất còn hạn mức: `gemini → groq → openai → assemblyai`.

- Thêm cấu hình thứ tự provider (ENV hoặc system_config).
- Endpoint `/proxy/transcribe` thử provider theo thứ tự đó nếu client gửi `provider: 'auto'`.
- Cần đồng bộ phía app để gửi `auto` hoặc danh sách ưu tiên.

## ✅ 3. Version-check + màn hình bắt buộc cập nhật app — ĐÃ LÀM

- Bảng `app_release_config_v2` (1 dòng, admin chỉnh được, không cần sửa ENV) + module `appReleaseConfig.ts` (so sánh phiên bản, đánh giá gate).
  → [schema.ts](../admin-backend/src/platform/schema.ts) · [appReleaseConfig.ts](../admin-backend/src/platform/appReleaseConfig.ts)
- Public: `GET /api/client/app-version?platform=&version=` → `{ minVersion, latestVersion, forceUpdate, notes, updateUrl, updateRequired, updateAvailable }`. Fail-open.
  → [routes/client.ts](../admin-backend/src/routes/client.ts)
- Admin: `GET/PUT /api/v2/admin/app-release` + tab **"Phiên bản app"** (nhập minVersion/latestVersion/forceUpdate/URL Android-iOS/changelog).
  → [routes/platform.ts](../admin-backend/src/routes/platform.ts) · [public/admin.js](../admin-backend/public/admin.js)
- App: `checkServerVersionGate()` chạy lúc mở app (chỉ native); nếu `updateRequired` → overlay **chặn, không bỏ qua được** + nút cập nhật; nếu chỉ `updateAvailable` thì để luồng GitHub release cũ xử lý (tùy chọn).
  → [services/updateService.ts](../services/updateService.ts) · [App.tsx](../App.tsx)
- i18n: thêm khóa `App.update.*` cho vi/en/zh/ko.

**Lưu ý vận hành:** chỉ bật `forceUpdate` khi đã có bản mới trên store/URL. Web không bị gate (tự cập nhật khi tải lại).

## ⏳ 4. Cảnh báo khi pool key sắp cạn

- Job/định kỳ kiểm tra tỉ lệ key `cooldown`/`disabled` mỗi provider.
- Vượt ngưỡng → gửi cảnh báo (webhook/email) để admin nạp thêm key free.

## ⏳ 5. OTA / live-update cho app

- Tích hợp Capacitor live updates / `@capgo/capacitor-updater` để vá phần web không chờ store duyệt.
- Giữ store cho thay đổi native (quyền, plugin).

## ⏳ 6. Theo dõi chi phí theo key/provider

- Mở rộng log usage: gắn `provider` + `keyId` + ước tính chi phí.
- Dashboard: biểu đồ chi phí theo provider/tháng để tối ưu ngân sách.

## ⏳ 7. Panel nhập ENV nhạy cảm an toàn trong admin

- Cho phép sửa một số cấu hình production ngay trên dashboard thay vì sửa ENV Vercel thủ công (có kiểm soát quyền).

---

### Thứ tự đề xuất triển khai tiếp
1. (#2) Provider rẻ-trước — cộng hưởng với #1 để giảm chi phí thêm.
2. (#4) Cảnh báo cạn pool — giữ dịch vụ không gián đoạn.
3. (#5, #6, #7) theo nguồn lực.
