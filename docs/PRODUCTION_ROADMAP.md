# TSrecord — Production Roadmap

> Cập nhật: 2026-06-11 | Điểm hiện tại: **9.0/10** — **Production ready**

## Tổng quan các phase

| Phase | Mục tiêu | Trạng thái |
|-------|----------|------------|
| **P0** | Backend an toàn, Vercel-ready | ✅ |
| **P1** | Auth, test, CI đầy đủ | ✅ |
| **P2** | Mobile parity, monitoring | ✅ |
| **P3** | Scale, tối ưu, compliance | ✅ |

---

## P3 — Scale & Compliance ✅

### Bundle optimization ✅

- Tách `react-vendor`, `react-dom-vendor`, `sentry-vendor`, `archive-vendor` trong `vite.config.ts`

### Chunked upload (proxy audio lớn) ✅

- Schema: `upload_sessions_v2`
- API: `POST /api/v2/uploads/init`, `POST /api/v2/uploads/:id/chunk`
- Proxy: `/api/client/proxy/transcribe` nhận `uploadSessionId`
- Frontend: `services/proxyUploadService.ts` (≤3MB base64, >3MB chunked)

### Promo v2 ✅

- Schema: `promo_codes_v2`
- `POST /api/client/redeem` (Postgres)
- Admin: `GET/POST /api/v2/admin/promo-codes`

### Stripe refund ✅

- `POST /api/v2/admin/orders/:orderCode/refund`
- Ghi `ledger_entries_v2` entry_type `refund`

### Migration SQLite → Postgres ✅

- `admin-backend/scripts/migrate-sqlite-to-postgres.ts`
- `npm run migrate:sqlite`

### Documentation ✅

- `README.md` — cập nhật đầy đủ
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/openapi-v2.yaml`

### Uptime alerts ✅

- `ALERT_WEBHOOK_URL` — webhook khi HTTP 5xx
- Health: version + purge upload sessions

### E-invoice (stub + auto-issue) ✅

- Schema: `einvoice_documents_v2`
- Tự phát hành sau `fulfillOrder` khi `einvoice_enabled`
- Admin: `GET /api/v2/admin/einvoices`, `GET/POST /api/v2/admin/orders/:orderCode/einvoice`
- Provider adapter: `manual` + stub (Viettel/MISA chưa kết nối API thật)

### Play Integrity API ✅

- Android plugin `PlayIntegrityPlugin` + `plugins/playIntegrity.ts`
- Backend verify: `platform/playIntegrity.ts`
- `GET /api/v2/devices/integrity/challenge`, token gửi kèm `POST /devices/register`
- Env: `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_INTEGRITY_REQUIRED`

### `@sentry/capacitor` native crashes ✅

- Pin `@sentry/react@10.52.0` + `@sentry/capacitor@4.1.0`
- `crashReporter.ts` dùng Capacitor SDK trên native

### Distributed rate limit (Upstash Redis) ✅

- `middleware/rateLimit.ts` — Upstash khi có `UPSTASH_REDIS_REST_*`, fallback in-memory
- Header `X-RateLimit-Backend: upstash|memory`

**Chưa làm (tích hợp bên thứ ba):**

- [ ] Hóa đơn điện tử Viettel/MISA API thật

---

## Điểm mục tiêu

| Phase | Điểm | Mức |
|-------|------|-----|
| Sau P2 | 8.0 | Gần production ready |
| **Sau P3+ (hiện tại)** | **9.0** | **Production ready** |

---

## Quick links

- [Deployment Runbook](DEPLOYMENT_RUNBOOK.md)
- [OpenAPI v2](openapi-v2.yaml)
- [Vercel Commerce Backend](../admin-backend/docs/VERCEL_COMMERCE_BACKEND.md)
