# Billing, Entitlements, and Cost Strategy

## 1. Muc tieu

- User free van dung duoc app voi key ca nhan.
- User co goi moi duoc bat `Dung key admin`.
- User co goi co the `Ket noi Google Drive` bang cau hinh cua chu he thong, khong can tu tao Google project rieng.
- Ads phai duoc dieu khien bang entitlement, khong phai chi an UI tam thoi.
- Admin phai thay duoc chi phi thuc te theo request, theo provider, theo user, theo thiet bi.

## 2. Phan tang quyen (entitlements)

### Free

- Dung key ca nhan cua user.
- Khong duoc bat `key admin`.
- Khong duoc dung `Google Drive system config`.
- Co the hien ads.

### Paid Monthly / Lifetime / Promo hop le

- `system_api_key`
- `system_google_drive`
- `disable_ads`
- Co the mo rong them: `priority_queue`, `higher_chunk_concurrency`, `premium_export`

## 3. Google Drive nen di theo huong nao

### Huong nen lam ngay

- Chu he thong cau hinh san `system_google_client_id` va `system_google_api_key` trong admin backend.
- App web/mobile khi user da co goi se dung cap key nay de mo OAuth + Google Picker.
- User van dang nhap vao Google cua CHINH HO, nhung khong can tu tao Google Cloud project.

### Luu y quan trong

- Khong the "tu dong vao Drive cua nguoi chu" theo cach an mot nut ma khong co co che uy quyen ro rang.
- Neu muon doc Drive cua admin/chu he thong that su, phai co server-side OAuth, refresh token, folder policy, audit log, va scope rat chat.
- Vi vay, MVP dung nen la: `owner-provided app credentials`, KHONG phai `owner account file access`.

## 4. Ads phai khoa bang server entitlement

- Frontend chi la lop hien thi.
- Nguon su that phai den tu `/api/client/license` hoac `/api/client/runtime-config`.
- Quy tac:
  - `disable_ads` co trong features => khong load banner, khong load interstitial, khong show ads truoc khi chay trich xuat.
  - Khong co `disable_ads` => free plan duoc phep show ads.

## 5. Cost model de khong lo khi request loi

## Nguyen tac

- Moi request AI phai duoc log.
- Moi chunk transcript phai duoc log rieng.
- Moi lan retry phai biet retry do user bam lai hay he thong retry.
- Moi request can co:
  - `request_type`: `transcribe`, `analysis`, `realtime`, `drive_import`
  - `provider`
  - `model`
  - `device_id`
  - `user_id`
  - `duration_seconds`
  - `file_size_bytes`
  - `input_units`
  - `output_units`
  - `status`: `started`, `success`, `failed`
  - `error_code`
  - `estimated_cost_usd`
  - `billable_cost_usd`
  - `retry_of_request_id`

## Cach tinh phi nen ap dung

### Transcription

- Gemini / Groq / OpenAI / AssemblyAI tinh theo `so phut audio`, lam tron len theo block nho.
- De tranh lo, khong tinh theo file hoc vien "cam tinh", ma tinh:
  - `billable_minutes = ceil(duration_seconds / 60)`
  - Co them `platform_margin_percent`
  - Co them `failure_buffer_percent`

### Analysis

- Tinh theo token input + token output hoac bang gia model cau hinh san.
- Luu gia theo thoi diem request, tranh truong hop doi gia provider roi bao cao sai lich su.

### Retry / loi

- Neu request fail truoc khi co ket qua tra user:
  - `estimated_cost_usd` van ghi nhan noi bo.
  - `customer_billable = 0` neu day la loi he thong.
- Neu user chu dong bam chay lai do doi prompt/provider:
  - request moi duoc tinh tiep.

## Goi y gia ban

- Gia ban khong nen dua tren 1 provider duy nhat.
- Cong thuc an toan:

`sale_price = infra_cost + ai_cost + payment_fee + support_buffer + profit_margin`

Trong do:

- `infra_cost`: luu tru, bang thong, server proxy, DB
- `ai_cost`: transcription + analysis + retry reserve
- `payment_fee`: phi ngan hang / SePay / doi soat
- `support_buffer`: dung cho cac ca loi, refund, user test
- `profit_margin`: bien loi nhuan muc tieu

## Vi du voi case 66 phut

- 66 phut ma chay 2 lan, 1 lan loi, tong hao phi noi bo ~1.6 USD thi he thong hien tai dang thieu:
  - log request cap chunk
  - tach `cost noi bo` va `phi tinh cho khach`
  - chinh sach retry

### Khuyen nghi

- Free: user tu dung key, nen he thong khong chiu AI cost chinh.
- Paid monthly/lifetime:
  - Cho dung key admin
  - Gioi han fair-use theo thang hoac theo tong phut
  - Co canh bao noi bo khi user vuot nguong cost

## 6. Bang admin nen co gi

### Dashboard chi phi

- Tong chi phi hom nay / thang nay
- Chi phi theo provider
- Chi phi theo user
- Chi phi theo thiet bi
- Chi phi request fail
- Ti le fail / success
- Doanh thu - chi phi = lai lo uoc tinh

### Bang request

- Request ID
- User / Device
- Thoi gian
- Request type
- Provider / Model
- Duration
- Status
- Estimated cost USD
- Billable cost USD
- Error

## 7. Thu tu trien khai de an toan

1. Entitlement server-side cho `system_api_key`, `system_google_drive`, `disable_ads`.
2. Khoa checkbox `Dung key admin` neu thiet bi chua co goi.
3. Cho Google Drive fallback sang cau hinh he thong.
4. Them bang `ai_request_logs` va ghi log cho moi request/chunk.
5. Them dashboard admin cho chi phi/request.
6. Sau cung moi bat ads logic va pricing automation.
