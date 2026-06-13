import { getPool } from './database.js';

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS platform_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_v2_email_unique
  ON app_users_v2 (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS devices_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users_v2(id) ON DELETE CASCADE,
  device_key text NOT NULL UNIQUE,
  platform text,
  app_version text,
  locale text,
  model text,
  os_version text,
  push_token text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS devices_v2_user_idx ON devices_v2(user_id);
CREATE INDEX IF NOT EXISTS devices_v2_last_seen_idx ON devices_v2(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS plans_v2 (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  duration_months integer,
  request_limit integer,
  price_vnd bigint NOT NULL,
  price_usd_minor integer,
  ads_enabled boolean NOT NULL DEFAULT false,
  own_key_enabled boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES app_users_v2(id),
  device_id uuid REFERENCES devices_v2(id),
  plan_code text NOT NULL REFERENCES plans_v2(code),
  provider text NOT NULL CHECK (provider IN ('sepay', 'stripe', 'manual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded', 'review')),
  currency text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  provider_reference text,
  expires_at timestamptz,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_v2_provider_ref_unique
  ON orders_v2(provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_v2_user_idx ON orders_v2(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_v2_status_idx ON orders_v2(status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  order_id uuid REFERENCES orders_v2(id),
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS entitlements_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users_v2(id) ON DELETE CASCADE,
  source_order_id uuid REFERENCES orders_v2(id),
  plan_code text NOT NULL REFERENCES plans_v2(code),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  request_limit integer,
  requests_used integer NOT NULL DEFAULT 0,
  ads_enabled boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entitlements_v2_user_idx
  ON entitlements_v2(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_profiles_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('household_business', 'company')),
  tax_code text,
  address text,
  accounting_basis text NOT NULL DEFAULT 'configured',
  vat_rate numeric(9,6),
  income_tax_rate numeric(9,6),
  corporate_tax_rate numeric(9,6),
  einvoice_provider text,
  einvoice_enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_profiles_v2_default_unique
  ON organization_profiles_v2(is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS ledger_entries_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organization_profiles_v2(id),
  order_id uuid REFERENCES orders_v2(id),
  user_id uuid REFERENCES app_users_v2(id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('sale', 'refund', 'payment_fee', 'tax', 'adjustment')),
  document_number text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  currency text NOT NULL,
  gross_amount_minor bigint NOT NULL DEFAULT 0,
  fee_amount_minor bigint NOT NULL DEFAULT 0,
  tax_amount_minor bigint NOT NULL DEFAULT 0,
  net_amount_minor bigint NOT NULL DEFAULT 0,
  description text,
  counterparty_name text,
  counterparty_tax_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_v2_occurred_idx
  ON ledger_entries_v2(occurred_at DESC);

CREATE TABLE IF NOT EXISTS einvoice_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders_v2(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organization_profiles_v2(id),
  provider text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'failed', 'cancelled')),
  invoice_number text,
  provider_reference text,
  buyer_name text,
  buyer_tax_code text,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VND',
  vat_rate numeric(9,6),
  tax_amount_minor bigint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS einvoice_documents_v2_order_idx
  ON einvoice_documents_v2(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS einvoice_documents_v2_status_idx
  ON einvoice_documents_v2(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_campaigns_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('admob', 'google_ads', 'custom')),
  placement text NOT NULL,
  format text NOT NULL CHECK (format IN ('banner', 'interstitial', 'rewarded', 'native')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  provider_unit_id text,
  creative jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_rules_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ad_campaigns_v2(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  max_per_day integer,
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_rules_v2_trigger_idx ON ad_rules_v2(trigger_key, enabled);

CREATE TABLE IF NOT EXISTS ad_rewards_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users_v2(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices_v2(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ad_rewards_v2_pending_idx
  ON ad_rewards_v2(device_id, created_at ASC)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS usage_logs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users_v2(id) ON DELETE SET NULL,
  device_id uuid REFERENCES devices_v2(id) ON DELETE SET NULL,
  action text NOT NULL,
  provider text,
  duration_seconds integer,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_logs_v2_created_idx
  ON usage_logs_v2(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key_hash text,
  action text NOT NULL,
  resource text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_v2_created_idx
  ON admin_audit_logs_v2(created_at DESC);

CREATE TABLE IF NOT EXISTS promo_codes_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  plan_code text NOT NULL REFERENCES plans_v2(code),
  duration_months integer,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_v2_active_idx
  ON promo_codes_v2(is_active, expires_at);

CREATE TABLE IF NOT EXISTS upload_sessions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  expected_bytes bigint NOT NULL CHECK (expected_bytes > 0),
  received_bytes bigint NOT NULL DEFAULT 0,
  max_bytes bigint NOT NULL,
  chunk_count integer NOT NULL DEFAULT 0,
  payload bytea,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'ready', 'consumed', 'expired')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_sessions_v2_device_idx
  ON upload_sessions_v2(device_key, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS ad_events_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES ad_campaigns_v2(id),
  rule_id uuid REFERENCES ad_rules_v2(id),
  user_id uuid REFERENCES app_users_v2(id),
  device_id uuid REFERENCES devices_v2(id),
  event_type text NOT NULL CHECK (event_type IN ('eligible', 'impression', 'click', 'reward', 'dismiss')),
  revenue_micros bigint,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cms_pages_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL DEFAULT 'vi',
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  eyebrow text NOT NULL DEFAULT 'TSrecord',
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cms_pages_v2 ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'vi';
ALTER TABLE cms_pages_v2 DROP CONSTRAINT IF EXISTS cms_pages_v2_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS cms_pages_v2_locale_slug_unique
  ON cms_pages_v2(locale, slug);
CREATE INDEX IF NOT EXISTS cms_pages_v2_locale_status_idx
  ON cms_pages_v2(locale, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cms_articles_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL DEFAULT 'vi',
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Kiến thức',
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  featured boolean NOT NULL DEFAULT false,
  reading_minutes integer NOT NULL DEFAULT 5 CHECK (reading_minutes > 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cms_articles_v2 ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'vi';
ALTER TABLE cms_articles_v2 DROP CONSTRAINT IF EXISTS cms_articles_v2_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS cms_articles_v2_locale_slug_unique
  ON cms_articles_v2(locale, slug);
CREATE INDEX IF NOT EXISTS cms_articles_v2_locale_public_idx
  ON cms_articles_v2(locale, status, published_at DESC, updated_at DESC);

-- Pool nhieu API key cho moi provider (Gemini/Groq/OpenAI/AssemblyAI).
-- Admin co the gan nhieu key, proxy xoay vong + tu failover khi 1 key loi.
CREATE TABLE IF NOT EXISTS provider_keys_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('gemini', 'groq', 'openai', 'assemblyai')),
  label text,
  key_value text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'cooldown', 'disabled')),
  cooldown_until timestamptz,
  last_used_at timestamptz,
  last_error text,
  use_count bigint NOT NULL DEFAULT 0,
  fail_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_keys_v2_pick_idx
  ON provider_keys_v2(provider, enabled, status, sort_order, last_used_at);

-- Gioi han so key moi provider (mac dinh 10), co the mo rong qua admin UI.
CREATE TABLE IF NOT EXISTS provider_key_limits_v2 (
  provider text PRIMARY KEY CHECK (provider IN ('gemini', 'groq', 'openai', 'assemblyai')),
  max_keys integer NOT NULL DEFAULT 10 CHECK (max_keys >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO provider_key_limits_v2 (provider, max_keys) VALUES
  ('gemini', 10), ('groq', 10), ('openai', 10), ('assemblyai', 10)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO plans_v2
  (code, name, duration_months, request_limit, price_vnd, price_usd_minor, ads_enabled, own_key_enabled, features)
VALUES
  ('monthly_20', 'Tiêu chuẩn 20 lượt', 1, 20, 39000, 199, false, false, '["system_api_key","system_google_drive","disable_ads"]'),
  ('monthly_50', 'Nâng cao 50 lượt', 1, 50, 59000, 299, false, false, '["system_api_key","system_google_drive","disable_ads"]'),
  ('monthly_100', 'Chuyên nghiệp 100 lượt', 1, 100, 99000, 499, false, false, '["system_api_key","system_google_drive","disable_ads"]'),
  ('own_key_ads', 'Dùng key cá nhân có quảng cáo', NULL, NULL, 199000, 799, true, true, '["own_key"]'),
  ('own_key_no_ads', 'Dùng key cá nhân không quảng cáo', NULL, NULL, 248000, 999, false, true, '["own_key","disable_ads"]'),
  ('disable_ads', 'Tắt quảng cáo', NULL, NULL, 49000, 199, false, false, '["disable_ads"]')
ON CONFLICT (code) DO NOTHING;
`;

let schemaPromise: Promise<void> | undefined;

export const ensurePlatformSchema = async (): Promise<void> => {
  schemaPromise ??= getPool().query(schemaSql).then(() => undefined);
  return schemaPromise;
};
