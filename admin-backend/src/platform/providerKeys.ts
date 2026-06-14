import { query, one } from './database.js';

export type KeyProvider = 'gemini' | 'groq' | 'openai' | 'assemblyai';

export const KEY_PROVIDERS: KeyProvider[] = ['gemini', 'groq', 'openai', 'assemblyai'];

export const isKeyProvider = (value: unknown): value is KeyProvider =>
  typeof value === 'string' && (KEY_PROVIDERS as string[]).includes(value);

/** 0 = key free (ưu tiên dùng trước để giảm chi phí), 1 = key trả phí (dự phòng). */
export type KeyTier = 0 | 1;

export interface ProviderKeyRow {
  id: string;
  provider: KeyProvider;
  label: string | null;
  key_value: string;
  enabled: boolean;
  sort_order: number;
  tier: number;
  status: 'ok' | 'cooldown' | 'disabled';
  cooldown_until: string | null;
  last_used_at: string | null;
  last_error: string | null;
  use_count: string;
  fail_count: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderKeyPublic {
  id: string;
  provider: KeyProvider;
  label: string | null;
  maskedKey: string;
  enabled: boolean;
  tier: number;
  status: 'ok' | 'cooldown' | 'disabled';
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  useCount: number;
  failCount: number;
}

export interface ProviderKeyCandidate {
  id: string;
  keyValue: string;
}

const DEFAULT_MAX_KEYS = 10;

/** Che key: chi lo 4 ky tu cuoi de admin doi chieu. */
export const maskKey = (value: string): string => {
  const trimmed = (value || '').trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
};

const toPublic = (row: ProviderKeyRow): ProviderKeyPublic => ({
  id: row.id,
  provider: row.provider,
  label: row.label,
  maskedKey: maskKey(row.key_value),
  enabled: row.enabled,
  tier: Number(row.tier) || 0,
  status: row.status,
  cooldownUntil: row.cooldown_until,
  lastUsedAt: row.last_used_at,
  lastError: row.last_error,
  useCount: Number(row.use_count) || 0,
  failCount: Number(row.fail_count) || 0,
});

export const getMaxKeys = async (provider: KeyProvider): Promise<number> => {
  const row = await one<{ max_keys: number }>(
    'SELECT max_keys FROM provider_key_limits_v2 WHERE provider = $1',
    [provider]
  );
  return row?.max_keys ?? DEFAULT_MAX_KEYS;
};

export const setMaxKeys = async (provider: KeyProvider, maxKeys: number): Promise<number> => {
  const next = Math.max(1, Math.min(1000, Math.round(maxKeys)));
  await query(
    `INSERT INTO provider_key_limits_v2 (provider, max_keys, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (provider) DO UPDATE SET max_keys = EXCLUDED.max_keys, updated_at = now()`,
    [provider, next]
  );
  return next;
};

export const countKeys = async (provider: KeyProvider): Promise<number> => {
  const row = await one<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM provider_keys_v2 WHERE provider = $1',
    [provider]
  );
  return Number(row?.count) || 0;
};

/** Danh sach key (da che) theo provider, kem max/count — dung cho admin UI. */
export const listProviderKeysGrouped = async (): Promise<
  Record<KeyProvider, { max: number; count: number; keys: ProviderKeyPublic[] }>
> => {
  const rows = await query<ProviderKeyRow>(
    'SELECT * FROM provider_keys_v2 ORDER BY provider, sort_order, created_at'
  );
  const result = {} as Record<KeyProvider, { max: number; count: number; keys: ProviderKeyPublic[] }>;
  for (const provider of KEY_PROVIDERS) {
    const keys = rows.filter((r) => r.provider === provider).map(toPublic);
    result[provider] = { max: await getMaxKeys(provider), count: keys.length, keys };
  }
  return result;
};

export const addProviderKey = async (
  provider: KeyProvider,
  keyValue: string,
  label?: string,
  tier: number = 0
): Promise<ProviderKeyPublic> => {
  const trimmed = (keyValue || '').trim();
  if (!trimmed) throw new Error('Key trống.');
  const normalizedTier = tier === 1 ? 1 : 0;

  const [max, current] = await Promise.all([getMaxKeys(provider), countKeys(provider)]);
  if (current >= max) {
    throw new Error(`Đã đạt giới hạn ${max} key cho ${provider}. Hãy mở rộng giới hạn trước.`);
  }

  const orderRow = await one<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM provider_keys_v2 WHERE provider = $1',
    [provider]
  );
  const row = await one<ProviderKeyRow>(
    `INSERT INTO provider_keys_v2 (provider, label, key_value, sort_order, tier)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [provider, label?.trim() || null, trimmed, orderRow?.next ?? 1, normalizedTier]
  );
  return toPublic(row as ProviderKeyRow);
};

export const updateProviderKey = async (
  id: string,
  patch: { enabled?: boolean; label?: string; resetStatus?: boolean; tier?: number }
): Promise<ProviderKeyPublic | null> => {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (typeof patch.enabled === 'boolean') {
    sets.push(`enabled = $${idx++}`);
    values.push(patch.enabled);
  }
  if (typeof patch.label === 'string') {
    sets.push(`label = $${idx++}`);
    values.push(patch.label.trim() || null);
  }
  if (patch.tier === 0 || patch.tier === 1) {
    sets.push(`tier = $${idx++}`);
    values.push(patch.tier);
  }
  if (patch.resetStatus) {
    sets.push(`status = 'ok'`, `cooldown_until = NULL`, `last_error = NULL`);
  }
  if (sets.length === 0) {
    const row = await one<ProviderKeyRow>('SELECT * FROM provider_keys_v2 WHERE id = $1', [id]);
    return row ? toPublic(row) : null;
  }
  sets.push('updated_at = now()');
  values.push(id);
  const row = await one<ProviderKeyRow>(
    `UPDATE provider_keys_v2 SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return row ? toPublic(row) : null;
};

export const deleteProviderKey = async (id: string): Promise<boolean> => {
  const rows = await query<{ id: string }>(
    'DELETE FROM provider_keys_v2 WHERE id = $1 RETURNING id',
    [id]
  );
  return rows.length > 0;
};

/**
 * Tra ve danh sach key kha dung cua provider, sap xep theo:
 *  1. tier ASC  -> key FREE (tier 0) duoc dung het truoc key TRA PHI (tier 1) => giam chi phi.
 *  2. last_used_at ASC -> trong cung mot hang, xoay vong (it dung gan nhat truoc).
 *  3. sort_order ASC -> tie-breaker on dinh.
 * Proxy se lan luot thu tung key (failover) trong cung 1 request. Key dang
 * cooldown se duoc dung lai khi het han.
 */
export const getKeyCandidates = async (provider: KeyProvider): Promise<ProviderKeyCandidate[]> => {
  const rows = await query<{ id: string; key_value: string }>(
    `SELECT id, key_value FROM provider_keys_v2
     WHERE provider = $1
       AND enabled = true
       AND (status = 'ok' OR (status = 'cooldown' AND (cooldown_until IS NULL OR cooldown_until <= now())))
     ORDER BY tier ASC, last_used_at ASC NULLS FIRST, sort_order ASC`,
    [provider]
  );
  return rows.map((r) => ({ id: r.id, keyValue: r.key_value }));
};

export const reportKeySuccess = async (id: string): Promise<void> => {
  await query(
    `UPDATE provider_keys_v2
     SET last_used_at = now(), use_count = use_count + 1,
         status = 'ok', cooldown_until = NULL, last_error = NULL, updated_at = now()
     WHERE id = $1`,
    [id]
  );
};

export const reportKeyFailure = async (
  id: string,
  opts: { disable?: boolean; cooldownSeconds?: number; error?: string }
): Promise<void> => {
  const status = opts.disable ? 'disabled' : opts.cooldownSeconds ? 'cooldown' : 'ok';
  const cooldownSeconds = opts.disable ? null : opts.cooldownSeconds ?? null;
  await query(
    `UPDATE provider_keys_v2
     SET last_used_at = now(), fail_count = fail_count + 1,
         status = $2,
         cooldown_until = CASE WHEN $3::int IS NULL THEN NULL ELSE now() + ($3::int || ' seconds')::interval END,
         last_error = $4, updated_at = now()
     WHERE id = $1`,
    [id, status, cooldownSeconds, (opts.error || '').slice(0, 500) || null]
  );
};

/**
 * Phan loai loi upstream de quyet dinh xu ly key:
 * - 401/403: key sai/het han/bi cam -> disable.
 * - 429: qua rate -> cooldown 60s.
 * - quota/exhausted/billing: het quota -> cooldown 6h.
 * - 5xx/khac: loi tam thoi -> cooldown 30s (van failover sang key khac).
 * Tra ve null neu KHONG phai loi key (de proxy giu nguyen hanh vi loi that su).
 */
export const classifyKeyError = (
  httpStatus: number,
  text: string
): { disable?: boolean; cooldownSeconds?: number } | null => {
  const lower = (text || '').toLowerCase();
  if (httpStatus === 401 || httpStatus === 403) return { disable: true };
  if (httpStatus === 429) {
    if (lower.includes('quota') || lower.includes('exhausted') || lower.includes('billing')) {
      return { cooldownSeconds: 6 * 60 * 60 };
    }
    return { cooldownSeconds: 60 };
  }
  if (lower.includes('quota') || lower.includes('exhausted') || lower.includes('api key') || lower.includes('invalid key')) {
    return { cooldownSeconds: 6 * 60 * 60 };
  }
  if (httpStatus >= 500) return { cooldownSeconds: 30 };
  return null;
};
