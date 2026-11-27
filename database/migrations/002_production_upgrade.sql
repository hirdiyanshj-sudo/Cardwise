-- Migration 002: Production Security, Bank Rules, Offer Verification, Reminder Tracking & Cashback Upgrade
-- Preserves all existing data cleanly via additive ALTER TABLE statements.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Account lockout columns for brute-force protection
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Refresh token rotation columns
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS refresh_family_id TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON user_sessions(refresh_token_hash);

-- 3. Bank-specific interest & late-fee rule configuration
ALTER TABLE banks ADD COLUMN IF NOT EXISTS late_fee_slabs_json TEXT;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS default_apr NUMERIC(5,2) NOT NULL DEFAULT 42.00;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS gst_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 18.00;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS min_due_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS min_due_floor NUMERIC(10,2) NOT NULL DEFAULT 100.00;

-- 4. Bank offers verification metadata & expanded categories
ALTER TABLE bank_offers ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE bank_offers ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE bank_offers ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE bank_offers ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bank_offers DROP CONSTRAINT IF EXISTS bank_offers_category_check;
ALTER TABLE bank_offers ADD CONSTRAINT bank_offers_category_check CHECK (
  category IN (
    'Shopping', 'Dining', 'Food delivery', 'Food and Dining', 'Travel', 'Flights',
    'Hotels', 'Movies', 'Entertainment', 'Fuel', 'Electronics', 'Cashback',
    'EMI', 'No-cost EMI', 'Reward multipliers', 'Financial'
  )
);

-- 5. Reminder delivery tracking, retries & timezones
ALTER TABLE payment_reminders ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE payment_reminders ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_reminders ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE payment_reminders ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE payment_reminders ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- 6. Cashback tracking on reward summary & ledger
ALTER TABLE reward_points ADD COLUMN IF NOT EXISTS total_cashback_inr NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE reward_transactions ADD COLUMN IF NOT EXISTS cashback_inr NUMERIC(12,2) NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (version) VALUES ('002_production_upgrade') ON CONFLICT (version) DO NOTHING;
