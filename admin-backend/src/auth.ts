import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './database.js';
import type { AdminUser } from './types.js';
import { getJwtSecret } from './config/production.js';

const getSecret = () => getJwtSecret();

export interface AuthRequest extends Request {
  adminId?: number;
  adminUsername?: string;
}

// ── Middleware: verify JWT ────────────────────────────────────
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Thiếu token xác thực.' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), getSecret()) as { id: number; username: string };
    req.adminId = payload.id;
    req.adminUsername = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

// ── Login ────────────────────────────────────────────────────
export const loginAdmin = (username: string, password: string): string | null => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined;
  if (!user) return null;

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return null;

  return jwt.sign({ id: user.id, username: user.username }, getSecret(), { expiresIn: '24h' });
};

// ── Create admin user ────────────────────────────────────────
export const createAdminUser = (username: string, password: string): void => {
  const db = getDb();
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
};
