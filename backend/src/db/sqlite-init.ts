import type { DatabaseSync } from 'node:sqlite';

export function initSqliteSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      full_name TEXT NOT NULL,
      mobile_number TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
      google_id TEXT UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      email_verification_token TEXT,
      password_reset_token TEXT,
      password_reset_expires_at TEXT,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret_encrypted TEXT,
      mfa_backup_codes_hash TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      mobile_encrypted TEXT,
      city TEXT DEFAULT 'Bengaluru',
      monthly_income_bracket TEXT DEFAULT '100000-200000',
      credit_score_self_reported INTEGER CHECK (credit_score_self_reported BETWEEN 300 AND 900),
      preferred_currency TEXT NOT NULL DEFAULT 'INR',
      avatar_url TEXT,
      privacy_analytics_opt_in INTEGER NOT NULL DEFAULT 1,
      privacy_marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_jti TEXT NOT NULL UNIQUE,
      device_label TEXT NOT NULL DEFAULT 'Web Browser',
      ip_address TEXT,
      user_agent TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banks (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      short_name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      support_url TEXT,
      brand_color TEXT NOT NULL DEFAULT '#0F172A',
      accent_color TEXT NOT NULL DEFAULT '#38BDF8',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bank_id TEXT REFERENCES banks(id) ON DELETE SET NULL,
      bank_name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      card_network TEXT NOT NULL CHECK (card_network IN ('Visa', 'Mastercard', 'RuPay', 'American Express')),
      card_type TEXT NOT NULL CHECK (card_type IN ('Lifetime Free', 'Cashback', 'Rewards', 'Travel', 'Shopping', 'Fuel')),
      last_four_digits TEXT NOT NULL CHECK (length(last_four_digits) = 4),
      credit_limit REAL NOT NULL CHECK (credit_limit > 0),
      available_credit_limit REAL NOT NULL CHECK (available_credit_limit >= 0),
      used_credit_limit REAL NOT NULL DEFAULT 0 CHECK (used_credit_limit >= 0),
      outstanding_balance REAL NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
      minimum_amount_due REAL NOT NULL DEFAULT 0 CHECK (minimum_amount_due >= 0),
      interest_rate REAL NOT NULL DEFAULT 42.0 CHECK (interest_rate >= 0),
      annual_fee REAL NOT NULL DEFAULT 0 CHECK (annual_fee >= 0),
      joining_fee REAL NOT NULL DEFAULT 0 CHECK (joining_fee >= 0),
      billing_cycle TEXT NOT NULL DEFAULT '16th - 15th',
      statement_generation_day INTEGER NOT NULL DEFAULT 15 CHECK (statement_generation_day BETWEEN 1 AND 28),
      payment_due_day INTEGER NOT NULL DEFAULT 5 CHECK (payment_due_day BETWEEN 1 AND 28),
      statement_generation_date TEXT,
      payment_due_date TEXT,
      reward_points_balance INTEGER NOT NULL DEFAULT 0 CHECK (reward_points_balance >= 0),
      reward_point_value_inr REAL NOT NULL DEFAULT 0.25,
      card_status TEXT NOT NULL DEFAULT 'Active' CHECK (card_status IN ('Active', 'Blocked', 'Expired')),
      card_color_theme TEXT DEFAULT 'navy-gold',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS card_billing_cycles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      cycle_start_date TEXT NOT NULL,
      cycle_end_date TEXT NOT NULL,
      statement_generation_date TEXT NOT NULL,
      payment_due_date TEXT NOT NULL,
      opening_balance REAL NOT NULL DEFAULT 0,
      total_spends REAL NOT NULL DEFAULT 0,
      total_payments REAL NOT NULL DEFAULT 0,
      closing_balance REAL NOT NULL DEFAULT 0,
      minimum_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Billed', 'Closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS statements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      billing_cycle_id TEXT REFERENCES card_billing_cycles(id) ON DELETE SET NULL,
      statement_month TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      statement_generation_date TEXT NOT NULL,
      payment_due_date TEXT NOT NULL,
      previous_balance REAL NOT NULL DEFAULT 0,
      new_charges REAL NOT NULL DEFAULT 0,
      payments_credits REAL NOT NULL DEFAULT 0,
      interest_charges REAL NOT NULL DEFAULT 0,
      total_amount_due REAL NOT NULL DEFAULT 0,
      minimum_amount_due REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Pending', 'Partially Paid', 'Overdue')),
      reward_points_earned INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spending_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL DEFAULT '#64748B',
      keywords TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      category_id TEXT REFERENCES spending_categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL DEFAULT 'Other expenses',
      merchant TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL CHECK (amount > 0),
      transaction_type TEXT NOT NULL DEFAULT 'Debit' CHECK (transaction_type IN ('Debit', 'Credit', 'Refund', 'EMI')),
      transaction_date TEXT NOT NULL DEFAULT (datetime('now')),
      reward_points_earned INTEGER NOT NULL DEFAULT 0,
      is_flagged_unusual INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      payment_date TEXT NOT NULL DEFAULT (datetime('now')),
      payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'NEFT', 'IMPS', 'NetBanking', 'Auto-Debit Record', 'Cheque', 'Other')),
      reference_number TEXT,
      payment_type TEXT NOT NULL DEFAULT 'Manual Record' CHECK (payment_type IN ('Manual Record', 'Full', 'Minimum', 'Partial')),
      status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Pending', 'Failed')),
      notes TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      reminder_stage TEXT NOT NULL CHECK (reminder_stage IN ('7_days_before', '3_days_before', '1_day_before', 'due_date', 'overdue')),
      due_date TEXT NOT NULL,
      amount_due REAL NOT NULL DEFAULT 0,
      channel_in_app INTEGER NOT NULL DEFAULT 1,
      channel_email INTEGER NOT NULL DEFAULT 1,
      channel_browser INTEGER NOT NULL DEFAULT 1,
      channel_sms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Sent', 'Dismissed')),
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_offers (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      bank_id TEXT REFERENCES banks(id) ON DELETE SET NULL,
      bank_name TEXT NOT NULL,
      title TEXT NOT NULL,
      applicable_cards TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN (
        'Shopping', 'Dining', 'Food delivery', 'Food and Dining', 'Travel', 'Flights',
        'Hotels', 'Movies', 'Entertainment', 'Fuel', 'Electronics', 'Cashback',
        'EMI', 'No-cost EMI', 'Reward multipliers', 'Financial'
      )),
      subcategory TEXT,
      merchant TEXT NOT NULL,
      discount_percentage REAL NOT NULL DEFAULT 0,
      max_discount REAL NOT NULL DEFAULT 0,
      min_transaction_amount REAL NOT NULL DEFAULT 0,
      offer_validity TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      terms_and_conditions TEXT NOT NULL,
      offer_source TEXT NOT NULL DEFAULT 'demo' CHECK (offer_source IN ('demo', 'manual', 'verified')),
      promo_code TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS card_offer_eligibility (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
      card_id TEXT REFERENCES credit_cards(id) ON DELETE CASCADE,
      bank_name TEXT NOT NULL,
      card_pattern TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS offer_bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, offer_id)
    );

    CREATE TABLE IF NOT EXISTS reward_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL UNIQUE REFERENCES credit_cards(id) ON DELETE CASCADE,
      total_earned INTEGER NOT NULL DEFAULT 0,
      total_redeemed INTEGER NOT NULL DEFAULT 0,
      total_expired INTEGER NOT NULL DEFAULT 0,
      current_balance INTEGER NOT NULL DEFAULT 0,
      conversion_rate_inr REAL NOT NULL DEFAULT 0.25,
      expiring_soon_points INTEGER NOT NULL DEFAULT 0,
      next_expiry_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reward_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL CHECK (action_type IN ('Earned', 'Redeemed', 'Expired', 'Adjusted')),
      points INTEGER NOT NULL,
      inr_value REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      redemption_partner TEXT,
      transaction_date TEXT NOT NULL DEFAULT (datetime('now')),
      expiry_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES spending_categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL,
      monthly_limit REAL NOT NULL CHECK (monthly_limit > 0),
      alert_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold_pct BETWEEN 10 AND 100),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, category_name)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN (
        'upcoming_bill', 'overdue_payment', 'new_offer', 'expiring_offer',
        'reward_expiry', 'high_utilisation', 'unusual_spending',
        'payment_confirmation', 'monthly_report', 'budget_alert', 'security'
      )),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger', 'success')),
      related_entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
      notify_in_app INTEGER NOT NULL DEFAULT 1,
      notify_email INTEGER NOT NULL DEFAULT 1,
      notify_browser INTEGER NOT NULL DEFAULT 1,
      notify_sms INTEGER NOT NULL DEFAULT 0,
      remind_7_days INTEGER NOT NULL DEFAULT 1,
      remind_3_days INTEGER NOT NULL DEFAULT 1,
      remind_1_day INTEGER NOT NULL DEFAULT 1,
      remind_due_date INTEGER NOT NULL DEFAULT 1,
      remind_overdue INTEGER NOT NULL DEFAULT 1,
      utilisation_alert_threshold INTEGER NOT NULL DEFAULT 30 CHECK (utilisation_alert_threshold BETWEEN 10 AND 95),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS card_catalog (
      id TEXT PRIMARY KEY,
      bank_name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      card_network TEXT NOT NULL,
      card_type TEXT NOT NULL,
      annual_fee REAL NOT NULL DEFAULT 0,
      joining_fee REAL NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL DEFAULT 42.0,
      cashback_pct REAL NOT NULL DEFAULT 0,
      reward_rate_pct REAL NOT NULL DEFAULT 1.5,
      lounge_access TEXT NOT NULL,
      dining_benefits TEXT NOT NULL,
      shopping_benefits TEXT NOT NULL,
      travel_benefits TEXT NOT NULL,
      fuel_benefits TEXT NOT NULL,
      movie_benefits TEXT NOT NULL,
      forex_markup_pct REAL NOT NULL DEFAULT 3.5,
      milestone_benefits TEXT NOT NULL,
      eligibility_criteria TEXT NOT NULL,
      best_for_categories TEXT NOT NULL,
      color_theme TEXT NOT NULL DEFAULT 'navy-gold'
    );

    CREATE TABLE IF NOT EXISTS card_comparisons (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Saved Card Comparison',
      compared_card_ids TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
  `);
}
