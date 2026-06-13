# TSrecord — Deployment Runbook

## Môi trường

| Môi trường | Frontend | Backend | Database |
|------------|----------|---------|----------|
| Local | Vite :3000 | Express :4000 | SQLite hoặc Postgres |
| Staging | Vercel preview | Vercel `admin-backend` | Postgres staging |
| Production | Vercel `tsrecord.vn` | Vercel/Fly `api.tsrecord.vn` | Postgres production |

## Deploy backend (Vercel)

1. Tạo project Vercel, **Root Directory** = `admin-backend`
2. Thêm Postgres (Vercel Marketplace hoặc Neon/Supabase)
3. Set biến môi trường (xem checklist bên dưới)
4. Chạy migration một lần từ máy local:

```powershell
cd admin-backend
$env:DATABASE_URL="postgresql://..."
npm run migrate:platform
```

5. Deploy production
6. Smoke test:

```bash
curl https://api.tsrecord.vn/api/v2/health
```

## Deploy frontend (Vercel)

1. Root Directory = `.` (repo root)
2. Build: `npm run build`
3. Output: `dist`
4. Set `VITE_BACKEND_URL=https://api.tsrecord.vn`
5. Deploy

## Checklist env production

### Backend

- [ ] `DATABASE_URL`
- [ ] `ADMIN_API_KEY`, `JWT_SECRET`, `DEVICE_AUTH_SECRET`
- [ ] `CORS_ALLOWED_ORIGINS=https://tsrecord.vn,https://www.tsrecord.vn`
- [ ] `SEPAY_WEBHOOK_API_KEY` hoặc `SEPAY_WEBHOOK_HMAC_SECRET`
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `ADMIN_GEMINI_API_KEY` (+ provider keys khác)
- [ ] `SENTRY_DSN`
- [ ] `ALERT_WEBHOOK_URL` (Slack/Discord webhook, tùy chọn)

### Frontend

- [ ] `VITE_BACKEND_URL`
- [ ] `VITE_SITE_URL=https://tsrecord.vn`
- [ ] `VITE_SENTRY_DSN`

## Migrate SQLite → PostgreSQL

Khi chuyển từ Fly.io SQLite sang Postgres:

```powershell
cd admin-backend
$env:DB_PATH="E:\path\to\tsrecord-admin.db"
$env:DATABASE_URL="postgresql://..."
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

Sau đó tắt route v1 trên Vercel (đã guard bằng `legacySqliteGuard`).

## Upload audio lớn (proxy)

- File ≤ 3MB: gửi `fileBase64` trực tiếp
- File > 3MB: chunked upload qua `/api/v2/uploads/init` + `/chunk`, rồi `uploadSessionId` trong `/api/client/proxy/transcribe`

Giới hạn mặc định: `UPLOAD_SESSION_MAX_BYTES=26214400` (25MB).

## Hoàn tiền Stripe (admin)

```http
POST /api/v2/admin/orders/TSRXXXXXXXXXXXX/refund
X-Admin-Api-Key: <key>
Content-Type: application/json

{ "reason": "customer_request" }
```

## Promo code v2 (admin)

```http
POST /api/v2/admin/promo-codes
X-Admin-Api-Key: <key>

{
  "code": "LAUNCH2026",
  "planCode": "monthly_20",
  "maxUses": 100,
  "durationMonths": 1
}
```

App redeem: `POST /api/client/redeem` hoặc `POST /api/v2/promo/redeem`.

## Upstash rate limit (production)

Set on Vercel backend:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Khi thiếu, backend fallback in-memory (`X-RateLimit-Backend: memory`).

## Play Integrity (Android, tùy chọn)

- `GOOGLE_PLAY_PACKAGE_NAME=com.trichxuatamthanh.app`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — service account có quyền Play Integrity
- `GOOGLE_CLOUD_PROJECT_NUMBER` — số project Google Cloud
- `PLAY_INTEGRITY_REQUIRED=true` — bắt buộc token khi đăng ký thiết bị Android

Sau deploy Android: `npm run android:sync` để đồng bộ plugin native.

## E-invoice (hóa đơn thông thường + ô API sẵn)

### Chạy backend local (giống mở .exe)

Double-click:

- `admin-backend/scripts/run-backend.bat` — khởi động server `http://localhost:4000`
- `admin-backend/scripts/issue-einvoices.bat` — phát hành hóa đơn cho đơn đã thanh toán chưa có HĐ

Hoặc terminal:

```bash
cd admin-backend
npm run dev
npm run einvoice:issue
npm run einvoice:issue -- --order TSRABCDEF123456
```

### Admin UI (nút bấm)

1. Mở `http://localhost:4000` (hoặc URL production)
2. Menu **Hóa đơn** → nhập `ADMIN_API_KEY` → **Lưu key**
3. Điền hồ sơ HKD, chọn provider **Hóa đơn thông thường (HTML)**
4. **Phát hành** từng đơn hoặc **Phát hành tất cả đơn chưa có HĐ**
5. **Xem / In** — mở HTML in hoặc lưu PDF

### Provider

| Provider | Mô tả |
|----------|--------|
| `internal` | Hóa đơn HTML chuẩn VN — dùng ngay, không cần API |
| `viettel` | Ô cấu hình API Viettel (stub sẵn) |
| `misa` | Ô cấu hình API MISA (stub sẵn) |
| `manual` | Chỉ lưu dữ liệu, xuất thủ công |

Sau thanh toán, hệ thống tự sinh HĐ nếu đã có hồ sơ tổ chức (`legal_name`).

## Rollback

1. Vercel: promote deployment trước đó
2. Database: không rollback schema tự động — backup trước migration
3. Tắt traffic: set maintenance flag trên CDN hoặc scale backend về 0

## Incident

1. Kiểm tra `GET /api/v2/health`
2. Xem Sentry (frontend + backend)
3. Kiểm tra `ALERT_WEBHOOK_URL` notifications
4. Logs JSON trên Vercel/Fly dashboard
