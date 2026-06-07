# Hướng dẫn chi tiết triển khai Admin Backend lên VPS Ubuntu Server

Tài liệu này hướng dẫn chi tiết từng bước thiết lập hệ điều hành, cài đặt môi trường, cấu hình lưu trữ SQLite và thiết lập Reverse Proxy SSL (HTTPS) cho hệ thống backend của ứng dụng `TSrecord` trên VPS chạy hệ điều hành **Ubuntu Server 22.04 LTS hoặc 24.04 LTS**.

---

## Bước 1: Kết nối vào VPS qua SSH

Mở Terminal trên máy tính của bạn và kết nối vào VPS bằng quyền root:
```bash
ssh root@<IP_CUA_VPS>
# Nhập mật khẩu VPS của bạn khi được yêu cầu
```

---

## Bước 2: Cập nhật hệ thống & Cài đặt công cụ cơ bản

Chạy các lệnh sau để cập nhật các gói phần mềm hệ thống lên phiên bản mới nhất:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw nginx
```

---

## Bước 3: Cấu hình Swap Memory (Bộ nhớ ảo phòng chống sập RAM)

Để đảm bảo VPS 1GB hoặc 2GB RAM không bị crash khi nhiều người dùng tải lên file âm thanh lớn cùng lúc, hãy tạo **2GB Swap**:
```bash
# Tạo file swap có dung lượng 2GB
sudo fallocate -l 2G /swapfile

# Phân quyền bảo mật cho file swap
sudo chmod 600 /swapfile

# Định dạng file swap
sudo mkswap /swapfile

# Kích hoạt swap
sudo swapon /swapfile

# Cấu hình tự động kích hoạt swap khi khởi động lại VPS
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Kiểm tra lại trạng thái bộ nhớ RAM & Swap
free -h
```

---

## Bước 4: Cài đặt Node.js (Phiên bản LTS 20)

Cài đặt Node.js phiên bản ổn định (LTS 20) thông qua NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiểm tra phiên bản node và npm cài đặt thành công
node -v
npm -v
```

---

## Bước 5: Sao chép dự án & Cài đặt Dependencies

1. Di chuyển vào thư mục `/var/www` và clone (hoặc tải) mã nguồn lên VPS:
   ```bash
   cd /var/www
   # Ví dụ clone từ git:
   # git clone <URL_GIT_CUA_BAN> tsrecord-backend
   # cd tsrecord-backend/admin-backend
   ```
2. Cài đặt các gói phụ thuộc (Dependencies) cho backend:
   ```bash
   # Di chuyển vào thư mục chứa code backend
   cd /var/www/tsrecord-backend/admin-backend
   
   # Cài đặt thư viện
   npm install
   
   # Build mã nguồn TypeScript sang JavaScript (dist/)
   npm run build
   ```

---

## Bước 6: Thiết lập Biến môi trường (.env)

Tạo file `.env` để cấu hình hệ thống:
```bash
nano .env
```
Nhập và thay thế các thông tin cấu hình sau (nhấn `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát):
```env
# Cổng chạy backend local
PORT=4000
NODE_ENV=production

# Khóa bí mật JWT (Hãy thay đổi thành chuỗi ngẫu nhiên dài bất kỳ)
JWT_SECRET=ThayTheBangChuoiMatKhauJWTNgauNhienCuaBan12345

# Tài khoản Admin mặc định để đăng nhập giao diện quản trị lần đầu
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MatKhauAdminTuChonCuaBan

# Đường dẫn lưu trữ Database SQLite vĩnh viễn trên VPS
DB_PATH=/var/www/tsrecord-backend/admin-backend/data/tsrecord-admin.db
```

Khởi tạo dữ liệu ban đầu cho database (tạo tài khoản admin cấu hình):
```bash
npm run seed
```

---

## Bước 7: Cài đặt và cấu hình PM2 để chạy ngầm tiến trình

PM2 giúp chạy ứng dụng Node.js dưới nền 24/7 và tự động bật lại nếu server bị sập hoặc restart.
```bash
# Cài đặt PM2 toàn cục
sudo npm install pm2 -g

# Khởi chạy ứng dụng
pm2 start dist/index.js --name "tsrecord-admin"

# Lưu cấu hình chạy của PM2
pm2 save

# Cấu hình tự động bật PM2 khi khởi động lại VPS
pm2 startup
# Lệnh trên sẽ sinh ra một lệnh dạng: sudo env PATH=... pm2 startup systemd -u root --hp ...
# Hãy copy và chạy lệnh đó để hoàn tất cấu hình tự khởi động.
```

*Các lệnh quản lý PM2 thường dùng:*
*   `pm2 status`: Xem trạng thái chạy của server.
*   `pm2 logs`: Xem log lỗi thời gian thực.
*   `pm2 restart tsrecord-admin`: Khởi động lại server.

---

## Bước 8: Cấu hình Nginx làm Reverse Proxy & Cài đặt SSL HTTPS

Nhà mạng SePay và Google Picker yêu cầu API phải chạy trên giao thức an toàn `https://`.

1. Tạo tệp cấu hình ảo Nginx cho domain của bạn (VD: `api.tsrecord.com`):
   ```bash
   sudo nano /etc/nginx/sites-available/tsrecord
   ```
2. Dán nội dung cấu hình sau vào (thay đổi `api.tsrecord.com` thành domain thật của bạn):
   ```nginx
   server {
       listen 80;
       server_name api.tsrecord.com;

       # Giới hạn kích thước file upload tối đa lên tới 100MB cho audio
       client_max_body_size 100M;

       location / {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Kích hoạt cấu hình và restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/tsrecord /etc/nginx/sites-enabled/
   sudo nginx -t # Kiểm tra cú pháp xem có lỗi không
   sudo systemctl restart nginx
   ```

4. Cài đặt chứng chỉ SSL HTTPS miễn phí với Let's Encrypt (Certbot):
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d api.tsrecord.com
   # Chọn option tự động chuyển hướng từ HTTP -> HTTPS (Redirect 2)
   ```

---

## Bước 9: Thiết lập Tường lửa bảo mật (UFW)

Chỉ mở các cổng cần thiết để hacker không quét được các lỗ hổng dịch vụ khác:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh      # Mở cổng SSH
sudo ufw allow 'Nginx Full' # Mở cổng 80 (HTTP) và 443 (HTTPS)
sudo ufw enable       # Bật tường lửa
```

---

## Bước 10: Cấu hình SePay Webhook nhận tiền tự động

1. Truy cập vào trang quản trị của bạn tại địa chỉ: `https://api.tsrecord.com` (Đăng nhập bằng tài khoản `ADMIN_USERNAME` và `ADMIN_PASSWORD` ở Bước 6).
2. Vào tab **Google Drive** và cấu hình các API Key hệ thống cho app hoạt động.
3. Nhấp sang tab **Gói dịch vụ** hoặc trang cấu hình chung để copy thông tin liên kết.
4. Đăng nhập vào tài khoản [SePay](https://sepay.vn), tạo một Webhook mới hướng đến URL:
   `https://api.tsrecord.com/api/webhooks/sepay`
5. Lấy chuỗi **Webhook Secret** trên SePay điền vào cài đặt cấu hình trong trang Admin của bạn để hệ thống tự động giải mã giao dịch chuyển khoản ngân hàng chính xác.
