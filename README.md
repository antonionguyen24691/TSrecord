# TSrecord — Trích xuất âm thanh AI

Ứng dụng web/mobile chuyển giọng nói thành văn bản, hỗ trợ họp/phỏng vấn, xuất DOCX/PPTX, freemium với thanh toán SePay/Stripe.

- **Web:** https://tsrecord.vn
- **App:** `/app`
- **API:** https://api.tsrecord.vn

## Yêu cầu

- Node.js 22+
- PostgreSQL (production backend)
- Android Studio / Xcode (build mobile tùy chọn)

## Chạy local

### Frontend

```bash
npm install
cp .env.example .env.local
npm run dev
```

API keys nhập trong **Settings** của app (lưu on-device). Không commit `.env.local`.

### Backend (PostgreSQL v2)

```bash
cd admin-backend
npm install
cp .env.example .env
npm run migrate:platform
npm run dev
```

Set `VITE_BACKEND_URL=http://localhost:4000` trong `.env.local`.

### Mobile

```bash
npm run build
npm run android:sync   # hoặc ios:sync
```

## Scripts chính

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Frontend Vite :3000 |
| `npm run build` | Build production |
| `npm test` | Vitest frontend |
| `cd admin-backend && npm run dev` | API :4000 |
| `cd admin-backend && npm run migrate:platform` | Schema PostgreSQL |
| `cd admin-backend && npx tsx scripts/migrate-sqlite-to-postgres.ts` | Migrate SQLite → Postgres |

## Kiến trúc

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | React 19, Vite 6, Tailwind 4, i18n |
| Mobile | Capacitor 8 (Android/iOS) |
| Backend v2 | Express, PostgreSQL (`/api/v2`) |
| Backend v1 | SQLite legacy (local/Fly, đang retire) |

Chi tiết deploy: [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md)  
API v2: [`docs/openapi-v2.yaml`](docs/openapi-v2.yaml)  
Roadmap: [`docs/PRODUCTION_ROADMAP.md`](docs/PRODUCTION_ROADMAP.md)

## Biến môi trường quan trọng

**Frontend:** `VITE_BACKEND_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN`  
**Backend:** `DATABASE_URL`, `ADMIN_API_KEY`, `JWT_SECRET`, `DEVICE_AUTH_SECRET`, `SENTRY_DSN`, `CORS_ALLOWED_ORIGINS`

Xem đầy đủ trong `.env.example` và `admin-backend/.env.example`.
