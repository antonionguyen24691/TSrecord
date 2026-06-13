/**
 * One-way migration helper: SQLite v1 users/subscriptions -> PostgreSQL v2.
 *
 * Usage:
 *   DB_PATH=./data/tsrecord-admin.db DATABASE_URL=postgresql://... npx tsx scripts/migrate-sqlite-to-postgres.ts
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { ensurePlatformSchema } from '../src/platform/schema.js';
import { getPool } from '../src/platform/database.js';

type SqliteUser = {
  id: number;
  device_id: string | null;
  email: string | null;
  display_name: string | null;
};

type SqliteSub = {
  user_id: number;
  plan: string;
  status: string;
  expires_at: string | null;
  requests_limit: number | null;
  requests_used: number;
  ads_enabled: number;
};

const sqlitePath = process.env.DB_PATH || 'data/tsrecord-admin.db';
const sqlite = new Database(sqlitePath, { readonly: true });

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  await ensurePlatformSchema();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const users = sqlite.prepare(
      'SELECT id, device_id, email, display_name FROM users'
    ).all() as SqliteUser[];

    let migratedUsers = 0;
    let migratedEntitlements = 0;

    for (const user of users) {
      const deviceKey = user.device_id?.trim();
      if (!deviceKey) continue;

      const existingDevice = await client.query<{ user_id: string }>(
        'SELECT user_id FROM devices_v2 WHERE device_key = $1 LIMIT 1',
        [deviceKey]
      );

      let userId = existingDevice.rows[0]?.user_id;
      if (!userId) {
        const appUser = await client.query<{ id: string }>(
          `INSERT INTO app_users_v2 (email, display_name)
           VALUES ($1, $2)
           RETURNING id`,
          [user.email?.trim().toLowerCase() || null, user.display_name || null]
        );
        userId = appUser.rows[0].id;
        await client.query(
          `INSERT INTO devices_v2 (user_id, device_key)
           VALUES ($1, $2)`,
          [userId, deviceKey]
        );
        migratedUsers += 1;
      }

      const sub = sqlite.prepare(
        `SELECT user_id, plan, status, expires_at, requests_limit, requests_used, ads_enabled
         FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      ).get(user.id) as SqliteSub | undefined;

      if (!sub || !userId) continue;

      const planCode = sub.plan.startsWith('monthly_') ? sub.plan : 'monthly_20';
      const exists = await client.query(
        `SELECT id FROM entitlements_v2
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
      if (exists.rows[0]) continue;

      await client.query(
        `INSERT INTO entitlements_v2
           (user_id, plan_code, status, expires_at, request_limit, requests_used, ads_enabled, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          userId,
          planCode,
          sub.status === 'active' ? 'active' : 'expired',
          sub.expires_at,
          sub.requests_limit,
          sub.requests_used,
          sub.ads_enabled === 0,
          JSON.stringify({ migratedFrom: 'sqlite', legacyPlan: sub.plan }),
        ]
      );
      migratedEntitlements += 1;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, migratedUsers, migratedEntitlements, sqlitePath }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
