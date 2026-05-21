# TSrecord Admin Backend

Hệ thống quản trị backend cho ứng dụng TSrecord — quản lý người dùng, thanh toán, promo code, và báo cáo doanh thu theo quy định HKD.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env
# Edit .env with your JWT_SECRET and admin credentials

# 3. Seed admin user
npm run seed

# 4. Start dev server
npm run dev
# → http://localhost:4000
```

## API Endpoints

### Admin (JWT required)
- `POST /api/admin/login` — Đăng nhập admin
- `GET /api/admin/me` — Thông tin admin hiện tại
- `PUT /api/admin/password` — Đổi mật khẩu

### Users
- `GET /api/users?page=&search=` — Danh sách users
- `GET /api/users/:id` — Chi tiết user
- `POST /api/users/:id/grant` — Cấp subscription thủ công
- `DELETE /api/users/:id/subscription` — Hủy subscription

### Payments
- `GET /api/payments?page=&status=` — Danh sách giao dịch
- `POST /api/payments/:id/refund` — Hoàn tiền
- `GET /api/payments/export?year=&month=` — Export CSV

### Promo Codes
- `GET /api/promo-codes` — Danh sách mã
- `POST /api/promo-codes` — Tạo mã mới
- `PUT /api/promo-codes/:id` — Sửa mã
- `DELETE /api/promo-codes/:id` — Xóa mã

### System Config
- `GET /api/config` — Toàn bộ cấu hình
- `PUT /api/config` — Cập nhật cấu hình
- `GET /api/config/payment-info` — Thông tin thanh toán (public)

### Statistics
- `GET /api/stats/dashboard` — Dashboard tổng quan
- `GET /api/stats/usage?from=&to=&action=` — Chi tiết usage
- `GET /api/stats/revenue?year=` — Doanh thu theo năm

### Webhooks (No auth)
- `POST /api/webhooks/sepay` — SePay callback
- `POST /api/webhooks/generic` — Webhook thanh toán chung

### Client API (No auth — for main app)
- `GET /api/client/license?device_id=` — Kiểm tra license
- `POST /api/client/redeem` — Nhập promo code
- `POST /api/client/usage` — Log usage
- `GET /api/client/payment-info` — Thông tin thanh toán

## Pricing
- **Gói tháng**: 69,000 VND/tháng
- **Gói trọn đời**: 999,000 VND
- **Promo code**: Cấu hình trong admin

## HKD Tax (Hộ Kinh Doanh)
- Thuế GTGT: 1% doanh thu
- Thuế TNCN: 0.5% doanh thu
- Tổng: 1.5% doanh thu
- Ngưỡng: 100 triệu VND/năm

## SePay Integration
1. Đăng ký tại [sepay.vn](https://sepay.vn)
2. Lấy API key và webhook secret
3. Cấu hình trong Admin → Cấu hình → Thanh toán SePay
4. Set webhook URL: `https://your-domain.com/api/webhooks/sepay`
5. Nội dung chuyển khoản format: `TSRECORD <device_id> <MONTHLY|LIFETIME>`
