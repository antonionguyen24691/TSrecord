import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb } from '../src/database.js';

const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
const password = process.env.ADMIN_PASSWORD?.trim();

if (!password) {
  console.error('[Reset] Thiếu ADMIN_PASSWORD trong .env');
  process.exit(1);
}

getDb();
const hash = bcrypt.hashSync(password, 12);
const result = getDb()
  .prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?')
  .run(hash, username);

if (result.changes === 0) {
  getDb()
    .prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
    .run(username, hash);
  console.log(`[Reset] Đã tạo user mới: ${username}`);
} else {
  console.log(`[Reset] Đã đặt lại mật khẩu cho: ${username}`);
}

console.log(`[Reset] Dùng mật khẩu trong ADMIN_PASSWORD (.env hiện tại).`);
