# CardWise – Smart Credit Card Manager

A production-ready full-stack Indian credit card management platform built with **React, TypeScript, Tailwind CSS, Recharts, Node.js, Express, PostgreSQL/Supabase-ready schema + migrations, and zero-config local SQLite**.

---

## Key Features & Security Architecture

- **Cookie-Based Authentication & CSRF Protection**:
  - Short-lived `15m` access token in `HttpOnly`, `SameSite`, `Secure` (production) cookie (`cw_access_token`).
  - Rotating `7d` refresh token (`cw_refresh_token`) stored hashed in `user_sessions` with **refresh token family reuse detection**.
  - Double-submit CSRF protection (`cw_csrf_token` + `X-CSRF-Token` header) on all state-changing routes.
  - Zero authentication secrets stored in `localStorage`.
  - Per-IP/account brute-force login lockout (`LOGIN_MAX_FAILURES` / `LOGIN_LOCKOUT_MINUTES`), `scrypt` password hashing, AES-256-GCM field encryption, RFC 6238 TOTP MFA + backup codes, Google OAuth (`GOOGLE_CLIENT_ID` token verification), session revocation, and production startup secret validation.
- **Strict Card Privacy & User Isolation**:
  - Never collects or stores complete card numbers, CVV, ATM PIN, OTPs, or netbanking passwords (enforced by API validation middleware).
  - Strict `user_id` ownership checks across all queries plus PostgreSQL Row Level Security (RLS) policies.
- **Main Financial Control Centre**: Live database totals, date-range filters (`7D`, `30D`, `90D`, `1Y`, `All`), credit utilisation indicator, interactive Recharts graphs, upcoming deadlines, recent activity timeline, and quick actions.
- **Indian Credit Card Management**: 11 major Indian banks (`HDFC`, `ICICI`, `SBI Card`, `Axis`, `Kotak`, `IDFC FIRST`, `IndusInd`, `American Express`, `AU Small Finance`, `Yes Bank`, `Federal Bank`), custom SVG bank/network badges, virtual card designs, card-wise dashboards, and utilisation tracker.
- **Billing, Bank-Specific Calculators & PDF Statements**: Auto-generate monthly statements from transactions, record partial/full manual payments, estimate late fees & interest using configurable bank-specific slabs + GST, and download PDF statements.
- **Automatic Payment Reminders**: Timezone-aware scheduler (`Asia/Kolkata` default, customizable) for 7d, 3d, 1d, due date, and overdue reminders with delivery status tracking, duplicate prevention, and safe retry backoff.
- **Verified Bank Offers & Admin Console**: Separate protected Administrator Console (`/admin`, `role = 'admin'`) to manage bank rules, card catalogue, offer verification (`source_url`, `verification_status`, `last_verified_at`), demo resets, and audit logs.
- **Rewards & Cashback Ledger**: Ledger-backed reward points and cashback tracking (`reward_transactions`) preventing arbitrary balance tampering from the frontend.
- **Spending Analytics, Budgets, Calendar & Exports**: Weekly/monthly/yearly reports, budgets & alerts, monthly/weekly financial calendar, CSV & PDF exports.

---

## Project Structure & Database Migrations

```text
cardwise/
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
│       ├── 001_initial.sql
│       └── 002_production_upgrade.sql
├── backend/
│   ├── src/
│   │   ├── config/env.ts         # Env & production startup secret validator
│   │   ├── db/
│   │   │   ├── index.ts          # PostgreSQL / SQLite adapter
│   │   │   ├── migrations.ts     # Additive migration runner
│   │   │   ├── seed.ts
│   │   │   └── sqlite-init.ts
│   │   ├── jobs/reminderJob.ts
│   │   ├── middleware/
│   │   ├── routes/               # Includes admin.ts
│   │   ├── tests/api.test.ts
│   │   └── utils/cookies.ts      # HttpOnly/SameSite/Secure cookie helpers
├── frontend/
│   └── src/
│       ├── pages/AdminPage.tsx   # Protected Admin Console
│       └── ...
├── .env.example
├── Start CardWise.bat
└── Stop CardWise.bat
```

---

## Local Setup & Running

1. **Install dependencies**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Environment Configuration**:
   Copy `.env.example` to `.env` in the root folder.
   - Leave `DATABASE_URL` blank for local SQLite (`backend/data/cardwise.db`), or set `DATABASE_URL` for PostgreSQL/Supabase.
   - **New Environment Variables**:
     - `TRUST_PROXY`: Set `true` behind reverse proxies (Nginx/Render/Cloudflare).
     - `COOKIE_SECURE`: Set `true` over HTTPS.
     - `VITE_GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_ID`: Google OAuth Client ID for live Google Sign-In.
     - `ADMIN_BOOTSTRAP_EMAIL` & `ADMIN_BOOTSTRAP_PASSWORD`: Optional admin account bootstrap (in `development`, defaults to `admin@cardwise.in` / `AdminWise@2026`).
     - `LOGIN_MAX_FAILURES` & `LOGIN_LOCKOUT_MINUTES`: Brute-force lockout thresholds.
3. **Run Locally**:
   - Backend: `cd backend && npm run dev` (`http://localhost:5000`)
   - Frontend: `cd frontend && npm run dev` (`http://localhost:5173`)
   - Or run `Start CardWise.bat` on Windows.
4. **Accounts for Local Evaluation**:
   - **Demo User**: `demo@cardwise.in` / `CardWise@2026` (or click **Try Demo Account**)
   - **Dev Admin**: `admin@cardwise.in` / `AdminWise@2026`

---

## Testing & Verification

```bash
cd backend && npm run build && npm test
cd ../frontend && npm run build
```

---

## Production Deployment

1. Run `database/schema.sql`, `database/migrations/002_production_upgrade.sql`, and `database/seed.sql` on your PostgreSQL / Supabase database.
2. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `FRONTEND_URL=https://your-domain.com`, strong 32+ char `JWT_SECRET` and `ENCRYPTION_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SMTP_*`, and `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`. (The backend refuses startup in production if `JWT_SECRET` or `ENCRYPTION_KEY` is missing or weak.)
3. Deploy `backend/dist` (built via `npm run build`) behind HTTPS and serve `frontend/dist` (`VITE_API_URL=https://api.your-domain.com/api`).
