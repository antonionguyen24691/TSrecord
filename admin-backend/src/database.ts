import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export const getDb = (): Database.Database => {
  if (db) return db;

  const dbPath = process.env.DB_PATH || 'data/tsrecord-admin.db';
  const fullPath = path.resolve(dbPath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(fullPath, { verbose: undefined });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
};

const runMigrations = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL CHECK(plan IN ('monthly', 'lifetime', 'promo')),
      status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'cancelled')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      promo_code_id INTEGER REFERENCES promo_codes(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id),
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
      transaction_ref TEXT UNIQUE,
      provider_data TEXT,
      invoice_number TEXT UNIQUE,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      plan TEXT NOT NULL CHECK(plan IN ('monthly', 'lifetime')),
      duration_months INTEGER,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      device_id TEXT,
      action TEXT NOT NULL,
      provider TEXT,
      duration_seconds INTEGER,
      file_size_bytes INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revenue_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      total_revenue INTEGER NOT NULL DEFAULT 0,
      total_transactions INTEGER NOT NULL DEFAULT 0,
      monthly_plan_revenue INTEGER NOT NULL DEFAULT 0,
      lifetime_plan_revenue INTEGER NOT NULL DEFAULT 0,
      tax_amount INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      UNIQUE(year, month)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
    CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
  `);

  // Seed default system config if empty
  const configCount = db.prepare('SELECT COUNT(*) as c FROM system_config').get() as { c: number };
  if (configCount.c === 0) {
    const insertConfig = db.prepare(
      'INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)'
    );

    const defaults: Array<[string, string, string]> = [
      ['sepay_enabled', 'false', 'Bật/tắt thanh toán qua SePay'],
      ['sepay_api_key', '', 'API key của SePay'],
      ['sepay_webhook_secret', '', 'Webhook secret để xác minh callback SePay'],
      ['sepay_bank_account', '', 'Số tài khoản ngân hàng nhận tiền SePay'],
      ['sepay_bank_name', '', 'Tên ngân hàng (VD: MB, Vietcombank)'],
      ['sepay_account_name', '', 'Tên chủ tài khoản'],
      ['webhook_generic_secret', '', 'Secret chung cho webhook thanh toán bên thứ 3'],
      ['monthly_price', '69000', 'Giá gói tháng (VND)'],
      ['lifetime_price', '999000', 'Giá gói trọn đời (VND)'],
      ['hkd_business_name', '', 'Tên Hộ Kinh Doanh (trên hóa đơn)'],
      ['hkd_tax_id', '', 'Mã số thuế HKD'],
      ['hkd_address', '', 'Địa chỉ HKD'],
      ['hkd_phone', '', 'Số điện thoại liên hệ'],
      ['invoice_prefix', 'TSR', 'Tiền tố số hóa đơn'],
      ['invoice_next_number', '1', 'Số hóa đơn tiếp theo'],
    ];

    const tx = db.transaction(() => {
      for (const [key, value, desc] of defaults) {
        insertConfig.run(key, value, desc);
      }
    });
    tx();
  }
};

// ── Helper: generate next invoice number ─────────────────────
export const generateInvoiceNumber = (): string => {
  const d = getDb();
  const prefix = (d.prepare("SELECT value FROM system_config WHERE key = 'invoice_prefix'").get() as { value: string })?.value || 'TSR';
  const row = d.prepare("SELECT value FROM system_config WHERE key = 'invoice_next_number'").get() as { value: string };
  const num = parseInt(row?.value || '1', 10);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const invoice = `${prefix}-${yearMonth}-${String(num).padStart(5, '0')}`;

  d.prepare("UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = 'invoice_next_number'")
    .run(String(num + 1));

  return invoice;
};

// ── Helper: update monthly revenue summary ───────────────────
export const updateRevenueSummary = (year: number, month: number): void => {
  const d = getDb();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const stats = d.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN p.subscription_id IS NOT NULL AND s.plan = 'monthly' THEN amount ELSE 0 END), 0) as monthly_plan_revenue,
      COALESCE(SUM(CASE WHEN p.subscription_id IS NOT NULL AND s.plan = 'lifetime' THEN amount ELSE 0 END), 0) as lifetime_plan_revenue
    FROM payments p
    LEFT JOIN subscriptions s ON p.subscription_id = s.id
    WHERE p.status = 'completed'
      AND p.completed_at >= ? AND p.completed_at < ?
  `).get(startDate, endDate) as {
    total_revenue: number;
    total_transactions: number;
    monthly_plan_revenue: number;
    lifetime_plan_revenue: number;
  };

  // Thuế HKD: 1.5% doanh thu (1% VAT + 0.5% TNCN)
  const taxAmount = Math.round(stats.total_revenue * 0.015);

  d.prepare(`
    INSERT INTO revenue_monthly (year, month, total_revenue, total_transactions, monthly_plan_revenue, lifetime_plan_revenue, tax_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(year, month) DO UPDATE SET
      total_revenue = excluded.total_revenue,
      total_transactions = excluded.total_transactions,
      monthly_plan_revenue = excluded.monthly_plan_revenue,
      lifetime_plan_revenue = excluded.lifetime_plan_revenue,
      tax_amount = excluded.tax_amount
  `).run(year, month, stats.total_revenue, stats.total_transactions, stats.monthly_plan_revenue, stats.lifetime_plan_revenue, taxAmount);
};
