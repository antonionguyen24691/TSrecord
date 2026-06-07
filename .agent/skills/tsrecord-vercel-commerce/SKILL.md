---
name: tsrecord-vercel-commerce
description: Extend TSrecord's Vercel backend for PostgreSQL, devices, SePay/Stripe payments, entitlements, revenue ledger, and ad triggers without returning to persistent SQLite assumptions.
---

# TSrecord Vercel Commerce

Use this skill for backend commerce, billing, accounting exports, device tracking,
SePay, Stripe, or ad-control work in `E:\trichxuatamthanh`.

## Required approach

1. Run the UTF-8 Vietnamese guard before reading or editing human text.
2. Read `admin-backend/docs/VERCEL_COMMERCE_BACKEND.md`.
3. Use `/api/v2` and PostgreSQL for new persistent backend behavior.
4. Create an order before invoking a payment provider.
5. Match SePay by opaque `order_code`, not email or device ID.
6. Verify webhook authentication and enforce `(provider, provider_event_id)` idempotency.
7. Activate entitlements and write the revenue ledger in the same database transaction.
8. Keep tax rates and accounting method configurable from the legal profile.
9. Treat the ledger as an internal accounting source, not a substitute for compliant e-invoices.
10. Enforce ad eligibility on the server from entitlement plus campaign rules.

## Verification

```powershell
Set-Location E:\trichxuatamthanh\admin-backend
npm.cmd run build
```

With a test PostgreSQL database:

```powershell
npm.cmd run migrate:platform
```

Use SePay Test Mode and Stripe test webhooks before production.

## Do not

- Persist production data in Vercel's filesystem.
- Fulfill from a client redirect.
- Fulfill Stripe Checkout when `payment_status` is not `paid`.
- Parse arbitrary transfer text when SePay provides a configured payment code.
- Hardcode a universal Vietnamese household-business tax rate.
- expose provider secrets or Google Ads access tokens to the app.
