# TSrecord Vercel Commerce Backend

## Kiến trúc

- `/api/v2` dùng PostgreSQL qua `DATABASE_URL`.
- Backend Express được export mặc định để Vercel đóng gói thành một Function.
- SQLite cũ chỉ còn phục vụ local/Fly trong giai đoạn chuyển đổi.
- Webhook dùng bảng `payment_events_v2` để chống xử lý trùng.
- Mọi thanh toán tạo `orders_v2` trước, sau đó mới kích hoạt `entitlements_v2`.
- Doanh thu được ghi vào `ledger_entries_v2`; không sửa trực tiếp giao dịch đã ghi nhận.

## Deploy Vercel

1. Tạo PostgreSQL trên Vercel Marketplace hoặc nhà cung cấp PostgreSQL serverless.
2. Đặt Root Directory của project Vercel là `admin-backend`.
3. Khai báo biến môi trường theo `.env.example`.
4. Chạy migration một lần:

```powershell
npm.cmd run migrate:platform
```

5. Deploy preview, kiểm tra webhook sandbox, sau đó mới promote production.

## SePay

Webhook:

```text
POST https://<backend>/api/v2/webhooks/sepay
```

Luồng:

1. App đăng ký thiết bị qua `POST /api/v2/devices/register`.
2. App tạo đơn `provider=sepay` qua `POST /api/v2/orders`.
3. Backend trả `qrUrl` và `orderCode`.
4. Nội dung chuyển khoản chỉ dùng `orderCode`, ví dụ `TSR12AB34CD56EF`.
5. SePay gửi webhook. Backend xác thực API key hoặc HMAC, khớp đơn và kích hoạt gói trong một transaction.

Không dùng email hoặc device ID trực tiếp trong nội dung chuyển khoản.

## Stripe

Webhook:

```text
POST https://<backend>/api/v2/webhooks/stripe
```

Stripe Checkout lưu `orderCode` trong metadata. Backend chỉ kích hoạt khi
`checkout.session.completed` có `payment_status=paid` và chữ ký webhook hợp lệ.

## Kế toán và thuế

`ledger_entries_v2` là sổ dữ liệu nội bộ để đối soát doanh thu, phí, hoàn tiền và
thuế đã thực sự ghi nhận. Hệ thống không tự tuyên bố số thuế phải nộp.

Hồ sơ `/api/v2/admin/organization` lưu loại chủ thể, phương pháp kế toán và các
thuế suất do kế toán hoặc đơn vị tư vấn xác nhận. Không hardcode mức 1,5% vì quy
định hộ kinh doanh năm 2026 phụ thuộc ngưỡng doanh thu, ngành nghề và phương pháp
tính thuế. Hóa đơn điện tử phải tích hợp với nhà cung cấp được lựa chọn trước khi
coi đây là hệ thống xuất hóa đơn hợp lệ.

## API quản trị v2

Các endpoint yêu cầu header:

```text
X-Admin-Api-Key: <ADMIN_API_KEY>
```

- `GET /api/v2/admin/devices`
- `GET /api/v2/admin/revenue?from=&to=`
- `GET /api/v2/admin/ledger`
- `GET /api/v2/admin/ledger.csv`
- `PUT /api/v2/admin/organization`
- `GET /api/v2/admin/ads/campaigns`
- `POST /api/v2/admin/ads/campaigns`
- `POST /api/v2/admin/ads/campaigns/:id/rules`
- `PATCH /api/v2/admin/ads/campaigns/:id/status`

## Quảng cáo

App gọi:

```text
GET /api/v2/ads/runtime?deviceKey=<id>&trigger=<trigger>
```

Backend xét entitlement, trạng thái chiến dịch, thời gian chạy, cooldown và giới
hạn mỗi ngày. App ghi impression/click/reward qua `POST /api/v2/ads/events`.

`google_ads` dùng cho quản lý chiến dịch/creative bên ngoài; quảng cáo trong app
nên dùng `admob` hoặc `custom`. Không đưa Google Ads access token vào client.

## Giới hạn cần xử lý tiếp

- Vercel Function giới hạn request/response khoảng 4,5 MB. Không gửi audio base64
  lớn qua `/api/client/proxy/transcribe`; cần direct upload hoặc signed upload URL.
- Admin UI cũ chưa chuyển sang các API v2.
- Cần thêm nhà cung cấp hóa đơn điện tử và luồng refund/chargeback thực tế.
- Cần rate limit, audit log admin và job đối soát SePay định kỳ trước production.
