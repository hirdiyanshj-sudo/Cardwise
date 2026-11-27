export interface User {
  id: string;
  email: string;
  fullName: string;
  mobileNumber?: string;
  role: 'user' | 'admin';
  authProvider?: 'email' | 'google';
  emailVerified: boolean;
  mfaEnabled: boolean;
  isDemoAccount?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  timezone: string;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyBrowser: boolean;
  notifySms: boolean;
  remind7Days: boolean;
  remind3Days: boolean;
  remind1Day: boolean;
  remindDueDate: boolean;
  remindOverdue: boolean;
  utilisationAlertThreshold: number;
}

export interface CreditCard {
  id: string;
  bank_name: string;
  card_name: string;
  card_network: 'Visa' | 'Mastercard' | 'RuPay' | 'American Express';
  card_type: 'Lifetime Free' | 'Cashback' | 'Rewards' | 'Travel' | 'Shopping' | 'Fuel';
  last_four_digits: string;
  credit_limit: number;
  available_credit_limit: number;
  used_credit_limit: number;
  outstanding_balance: number;
  minimum_amount_due: number;
  interest_rate: number;
  annual_fee: number;
  joining_fee: number;
  billing_cycle: string;
  statement_generation_date?: string;
  payment_due_date?: string;
  reward_points_balance: number;
  reward_point_value_inr: number;
  card_status: 'Active' | 'Blocked' | 'Expired';
  card_color_theme?: string;
  utilisation_pct?: number;
  is_demo?: boolean;
}

export interface Statement {
  id: string;
  card_id: string;
  bank_name: string;
  card_name: string;
  last_four_digits: string;
  statement_month: string;
  billing_period: string;
  statement_generation_date: string;
  payment_due_date: string;
  total_amount_due: number;
  minimum_amount_due: number;
  amount_paid: number;
  payment_status: 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue';
  reward_points_earned: number;
  interest_rate?: number;
}

export interface Transaction {
  id: string;
  card_id: string;
  bank_name?: string;
  card_name?: string;
  last_four_digits?: string;
  category_name: string;
  merchant: string;
  description?: string;
  amount: number;
  transaction_type: 'Debit' | 'Credit' | 'Refund' | 'EMI';
  transaction_date: string;
  reward_points_earned: number;
  is_flagged_unusual?: number | boolean;
  is_demo?: number | boolean;
}

export interface BankOffer {
  id: string;
  bank_name: string;
  title: string;
  applicable_cards: string;
  category: string;
  subcategory?: string;
  merchant: string;
  discount_percentage: number;
  max_discount: number;
  min_transaction_amount: number;
  offer_validity: string;
  expiry_date: string;
  terms_and_conditions: string;
  offer_source: 'demo' | 'manual' | 'verified';
  verification_status?: 'demo' | 'verified' | 'unverified' | 'expired';
  source_url?: string;
  last_verified_at?: string;
  promo_code?: string;
  is_bookmarked: boolean;
  user_id?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  is_read: boolean;
  created_at: string;
}
