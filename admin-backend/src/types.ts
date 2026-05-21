// ── Plan & subscription ──────────────────────────────────────
export type PlanType = 'monthly' | 'lifetime' | 'promo';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'sepay' | 'bank_transfer' | 'manual';

export const PLAN_PRICES: Record<string, number> = {
  monthly: 69_000,
  lifetime: 999_000,
};

// ── Database row types ───────────────────────────────────────
export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface AppUser {
  id: number;
  device_id: string | null;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan: PlanType;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  promo_code_id: number | null;
  created_at: string;
}

export interface Payment {
  id: number;
  user_id: number;
  subscription_id: number | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_ref: string | null;
  provider_data: string | null;
  invoice_number: string | null;
  note: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  plan: PlanType;
  duration_months: number | null;
  max_uses: number;
  used_count: number;
  is_active: number;
  expires_at: string | null;
  created_at: string;
}

export interface UsageLog {
  id: number;
  user_id: number | null;
  device_id: string | null;
  action: string;
  provider: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface RevenueMonthly {
  id: number;
  year: number;
  month: number;
  total_revenue: number;
  total_transactions: number;
  monthly_plan_revenue: number;
  lifetime_plan_revenue: number;
  tax_amount: number;
  notes: string | null;
}

// ── HKD tax rates (Hộ Kinh Doanh) ──────────────────────────
// Theo Thông tư 40/2021/TT-BTC:
// - Thuế GTGT: 1% doanh thu (dịch vụ CNTT)
// - Thuế TNCN: 0.5% doanh thu (dịch vụ)
// Ngưỡng doanh thu chịu thuế: 100 triệu VND/năm
export const HKD_TAX = {
  VAT_RATE: 0.01,
  PIT_RATE: 0.005,
  TOTAL_RATE: 0.015,
  ANNUAL_THRESHOLD: 100_000_000,
};

// ── API response types ───────────────────────────────────────
export interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  todayUsage: number;
  recentPayments: Payment[];
  usageByType: Array<{ action: string; count: number }>;
  revenueByMonth: RevenueMonthly[];
}

export interface ClientLicenseResponse {
  valid: boolean;
  plan: PlanType | null;
  expiresAt: string | null;
  features: string[];
}
