import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { loginAdmin, requireAdmin, type AuthRequest } from '../auth.js';
import { getDb } from '../database.js';

const router = Router();

// POST /api/admin/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Thiếu username hoặc password.' });
    return;
  }

  const token = loginAdmin(username, password);
  if (!token) {
    res.status(401).json({ error: 'Sai thông tin đăng nhập.' });
    return;
  }

  res.json({ token, username });
});

// GET /api/admin/me
router.get('/me', requireAdmin, (req: AuthRequest, res: Response) => {
  res.json({ id: req.adminId, username: req.adminUsername });
});

// PUT /api/admin/password
router.put('/password', requireAdmin, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Mật khẩu mới phải từ 8 ký tự.' });
    return;
  }

  const token = loginAdmin(req.adminUsername!, currentPassword);
  if (!token) {
    res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  getDb().prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, req.adminId);
  res.json({ ok: true });
});

export default router;
