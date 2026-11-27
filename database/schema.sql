-- ============================================================================
-- CardWise – Smart Credit Card Manager
-- PostgreSQL / Supabase Complete Database Schema (19 Core Tables + Supporting)
-- Includes Foreign Keys, Indexes, Constraints, and Row Level Security (RLS)
-- NEVER stores full card numbers, CVV, ATM PIN, netbanking passwords, or OTPs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT NOT NULL,
  mobile_number TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
  google_id TEXT UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token TEXT,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted TEXT,
  mfa_backup_codes_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile_encrypted TEXT,
  city TEXT DEFAULT 'Bengaluru',
  monthly_income_bracket TEXT DEFAULT '100000-200000',
  credit_score_self_reported INTEGER CHECK (credit_score_self_reported BETWEEN 300 AND 900),
  preferred_currency TEXT NOT NULL DEFAULT 'INR',
  avatar_url TEXT,
  privacy_analytics_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supporting: user_sessions (session management & revocation)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL DEFAULT 'Web Browser',
  ip_address TEXT,
  user_agent TEXT,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. banks
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  support_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#0F172A',
  accent_color TEXT NOT NULL DEFAULT '#38BDF8',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. credit_cards (STRICTLY NO CVV, PIN, OTP, OR FULL CARD NUMBER)
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_network TEXT NOT NULL CHECK (card_network IN ('Visa', 'Mastercard', 'RuPay', 'American Express')),
  card_type TEXT NOT NULL CHECK (card_type IN ('Lifetime Free', 'Cashback', 'Rewards', 'Travel', 'Shopping', 'Fuel')),
  last_four_digits TEXT NOT NULL CHECK (last_four_digits ~ '^[0-9]{4}$'),
  credit_limit NUMERIC(14,2) NOT NULL CHECK (credit_limit > 0),
  available_credit_limit NUMERIC(14,2) NOT NULL CHECK (available_credit_limit >= 0),
  used_credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (used_credit_limit >= 0),
  outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
  minimum_amount_due NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (minimum_amount_due >= 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 42.00 CHECK (interest_rate >= 0),
  annual_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (annual_fee >= 0),
  joining_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (joining_fee >= 0),
  billing_cycle TEXT NOT NULL DEFAULT '16th - 15th',
  statement_generation_day INTEGER NOT NULL DEFAULT 15 CHECK (statement_generation_day BETWEEN 1 AND 28),
  payment_due_day INTEGER NOT NULL DEFAULT 5 CHECK (payment_due_day BETWEEN 1 AND 28),
  statement_generation_date DATE,
  payment_due_date DATE,
  reward_points_balance INTEGER NOT NULL DEFAULT 0 CHECK (reward_points_balance >= 0),
  reward_point_value_inr NUMERIC(6,2) NOT NULL DEFAULT 0.25,
  card_status TEXT NOT NULL DEFAULT 'Active' CHECK (card_status IN ('Active', 'Blocked', 'Expired')),
  card_color_theme TEXT DEFAULT 'navy-gold',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. card_billing_cycles
CREATE TABLE IF NOT EXISTS card_billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  statement_generation_date DATE NOT NULL,
  payment_due_date DATE NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_spends NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_payments NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  minimum_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Billed', 'Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. statements
CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  billing_cycle_id UUID REFERENCES card_billing_cycles(id) ON DELETE SET NULL,
  statement_month TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  statement_generation_date DATE NOT NULL,
  payment_due_date DATE NOT NULL,
  previous_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  payments_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  minimum_amount_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Pending', 'Partially Paid', 'Overdue')),
  reward_points_earned INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. spending_categories (created before transactions for FK)
CREATE TABLE IF NOT EXISTS spending_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#64748B',
  keywords TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  category_id UUID REFERENCES spending_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'Other expenses',
  merchant TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  transaction_type TEXT NOT NULL DEFAULT 'Debit' CHECK (transaction_type IN ('Debit', 'Credit', 'Refund', 'EMI')),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reward_points_earned INTEGER NOT NULL DEFAULT 0,
  is_flagged_unusual BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'NEFT', 'IMPS', 'NetBanking', 'Auto-Debit Record', 'Cheque', 'Other')),
  reference_number TEXT,
  payment_type TEXT NOT NULL DEFAULT 'Manual Record' CHECK (payment_type IN ('Manual Record', 'Full', 'Minimum', 'Partial')),
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Pending', 'Failed')),
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. payment_reminders
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  reminder_stage TEXT NOT NULL CHECK (reminder_stage IN ('7_days_before', '3_days_before', '1_day_before', 'due_date', 'overdue')),
  due_date DATE NOT NULL,
  amount_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  channel_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  channel_email BOOLEAN NOT NULL DEFAULT TRUE,
  channel_browser BOOLEAN NOT NULL DEFAULT TRUE,
  channel_sms BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Sent', 'Dismissed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. bank_offers
CREATE TABLE IF NOT EXISTS bank_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  title TEXT NOT NULL,
  applicable_cards TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Shopping', 'Food and Dining', 'Travel', 'Entertainment', 'Financial')),
  subcategory TEXT,
  merchant TEXT NOT NULL,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_transaction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  offer_validity TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  terms_and_conditions TEXT NOT NULL,
  offer_source TEXT NOT NULL DEFAULT 'demo' CHECK (offer_source IN ('demo', 'manual', 'verified')),
  promo_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. card_offer_eligibility
CREATE TABLE IF NOT EXISTS card_offer_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_pattern TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supporting: offer_bookmarks
CREATE TABLE IF NOT EXISTS offer_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, offer_id)
);

-- 12. reward_points
CREATE TABLE IF NOT EXISTS reward_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL UNIQUE REFERENCES credit_cards(id) ON DELETE CASCADE,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_redeemed INTEGER NOT NULL DEFAULT 0,
  total_expired INTEGER NOT NULL DEFAULT 0,
  current_balance INTEGER NOT NULL DEFAULT 0,
  conversion_rate_inr NUMERIC(6,2) NOT NULL DEFAULT 0.25,
  expiring_soon_points INTEGER NOT NULL DEFAULT 0,
  next_expiry_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. reward_transactions
CREATE TABLE IF NOT EXISTS reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('Earned', 'Redeemed', 'Expired', 'Adjusted')),
  points INTEGER NOT NULL,
  inr_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  redemption_partner TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES spending_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  monthly_limit NUMERIC(14,2) NOT NULL CHECK (monthly_limit > 0),
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold_pct BETWEEN 10 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_name)
);

-- 16. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'upcoming_bill', 'overdue_payment', 'new_offer', 'expiring_offer',
    'reward_expiry', 'high_utilisation', 'unusual_spending',
    'payment_confirmation', 'monthly_report', 'budget_alert', 'security'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger', 'success')),
  related_entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_browser BOOLEAN NOT NULL DEFAULT TRUE,
  notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
  remind_7_days BOOLEAN NOT NULL DEFAULT TRUE,
  remind_3_days BOOLEAN NOT NULL DEFAULT TRUE,
  remind_1_day BOOLEAN NOT NULL DEFAULT TRUE,
  remind_due_date BOOLEAN NOT NULL DEFAULT TRUE,
  remind_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  utilisation_alert_threshold INTEGER NOT NULL DEFAULT 30 CHECK (utilisation_alert_threshold BETWEEN 10 AND 95),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supporting: card_catalog (reference database of Indian credit cards for comparison & recommendations)
CREATE TABLE IF NOT EXISTS card_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_network TEXT NOT NULL,
  card_type TEXT NOT NULL,
  annual_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  joining_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 42.0,
  cashback_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  reward_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  lounge_access TEXT NOT NULL,
  dining_benefits TEXT NOT NULL,
  shopping_benefits TEXT NOT NULL,
  travel_benefits TEXT NOT NULL,
  fuel_benefits TEXT NOT NULL,
  movie_benefits TEXT NOT NULL,
  forex_markup_pct NUMERIC(4,2) NOT NULL DEFAULT 3.5,
  milestone_benefits TEXT NOT NULL,
  eligibility_criteria TEXT NOT NULL,
  best_for_categories TEXT NOT NULL,
  color_theme TEXT NOT NULL DEFAULT 'navy-gold'
);

-- 18. card_comparisons
CREATE TABLE IF NOT EXISTS card_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Saved Card Comparison',
  compared_card_ids TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_statements_user_card ON statements(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_card ON payments(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON payment_reminders(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_offers_bank_cat ON bank_offers(bank_name, category, expiry_date);
CREATE INDEX IF NOT EXISTS idx_rewards_user_card ON reward_transactions(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id, token_jti);

-- ============================================================================
-- ROW LEVEL SECURITY (Supabase / PostgreSQL RLS)
-- Ensures strict per-user isolation at the database engine layer.
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_policy ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY profiles_self_policy ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY sessions_self_policy ON user_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY cards_self_policy ON credit_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY cycles_self_policy ON card_billing_cycles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY statements_self_policy ON statements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY transactions_self_policy ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY payments_self_policy ON payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY reminders_self_policy ON payment_reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY offers_read_policy ON bank_offers FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY offers_write_policy ON bank_offers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY bookmarks_self_policy ON offer_bookmarks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY reward_points_self_policy ON reward_points FOR ALL USING (auth.uid() = user_id);
CREATE POLICY reward_tx_self_policy ON reward_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY budgets_self_policy ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY notifications_self_policy ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY preferences_self_policy ON user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY comparisons_self_policy ON card_comparisons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY audit_logs_self_policy ON audit_logs FOR SELECT USING (auth.uid() = user_id);
