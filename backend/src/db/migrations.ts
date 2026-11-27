import type { DbClient } from './index.js';

export interface LateFeeSlab {
  upTo: number | null;
  fee: number;
  label: string;
}

export const BANK_CALCULATION_DEFAULTS: Record<
  string,
  {
    defaultApr: number;
    minDuePct: number;
    minDueFloor: number;
    slabs: LateFeeSlab[];
  }
> = {
  'HDFC Bank': {
    defaultApr: 43.2,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 10000, fee: 600, label: '₹5,001 – ₹10,000' },
      { upTo: 25000, fee: 800, label: '₹10,001 – ₹25,000' },
      { upTo: 50000, fee: 1100, label: '₹25,001 – ₹50,000' },
      { upTo: null, fee: 1300, label: 'Above ₹50,000' },
    ],
  },
  'ICICI Bank': {
    defaultApr: 42.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 10000, fee: 750, label: '₹5,001 – ₹10,000' },
      { upTo: 25000, fee: 900, label: '₹10,001 – ₹25,000' },
      { upTo: 50000, fee: 1100, label: '₹25,001 – ₹50,000' },
      { upTo: null, fee: 1300, label: 'Above ₹50,000' },
    ],
  },
  'SBI Card': {
    defaultApr: 42.0,
    minDuePct: 5,
    minDueFloor: 200,
    slabs: [
      { upTo: 500, fee: 0, label: 'Up to ₹500' },
      { upTo: 1000, fee: 400, label: '₹501 – ₹1,000' },
      { upTo: 10000, fee: 750, label: '₹1,001 – ₹10,000' },
      { upTo: 25000, fee: 950, label: '₹10,001 – ₹25,000' },
      { upTo: 50000, fee: 1100, label: '₹25,001 – ₹50,000' },
      { upTo: null, fee: 1300, label: 'Above ₹50,000' },
    ],
  },
  'Axis Bank': {
    defaultApr: 43.2,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 500, fee: 0, label: 'Up to ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 10000, fee: 750, label: '₹5,001 – ₹10,000' },
      { upTo: 25000, fee: 1000, label: '₹10,001 – ₹25,000' },
      { upTo: 50000, fee: 1200, label: '₹25,001 – ₹50,000' },
      { upTo: null, fee: 1200, label: 'Above ₹50,000' },
    ],
  },
  'Kotak Mahindra Bank': {
    defaultApr: 42.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 10000, fee: 600, label: '₹501 – ₹10,000' },
      { upTo: 25000, fee: 900, label: '₹10,001 – ₹25,000' },
      { upTo: null, fee: 1200, label: 'Above ₹25,000' },
    ],
  },
  'IDFC FIRST Bank': {
    defaultApr: 36.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 25000, fee: 850, label: '₹5,001 – ₹25,000' },
      { upTo: null, fee: 1250, label: 'Above ₹25,000' },
    ],
  },
  'IndusInd Bank': {
    defaultApr: 46.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 1000, fee: 350, label: '₹501 – ₹1,000' },
      { upTo: 10000, fee: 600, label: '₹1,001 – ₹10,000' },
      { upTo: 25000, fee: 800, label: '₹10,001 – ₹25,000' },
      { upTo: null, fee: 1300, label: 'Above ₹25,000' },
    ],
  },
  'American Express': {
    defaultApr: 42.0,
    minDuePct: 5,
    minDueFloor: 250,
    slabs: [
      { upTo: 1000, fee: 0, label: 'Up to ₹1,000' },
      { upTo: 10000, fee: 600, label: '₹1,001 – ₹10,000' },
      { upTo: 25000, fee: 900, label: '₹10,001 – ₹25,000' },
      { upTo: null, fee: 1300, label: 'Above ₹25,000' },
    ],
  },
  'AU Small Finance Bank': {
    defaultApr: 43.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 25000, fee: 900, label: '₹5,001 – ₹25,000' },
      { upTo: null, fee: 1300, label: 'Above ₹25,000' },
    ],
  },
  'Yes Bank': {
    defaultApr: 45.0,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 25000, fee: 900, label: '₹5,001 – ₹25,000' },
      { upTo: null, fee: 1200, label: 'Above ₹25,000' },
    ],
  },
  'Federal Bank': {
    defaultApr: 43.8,
    minDuePct: 5,
    minDueFloor: 100,
    slabs: [
      { upTo: 100, fee: 0, label: 'Up to ₹100' },
      { upTo: 500, fee: 100, label: '₹101 – ₹500' },
      { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
      { upTo: 25000, fee: 850, label: '₹5,001 – ₹25,000' },
      { upTo: null, fee: 1200, label: 'Above ₹25,000' },
    ],
  },
};

async function hasColumn(db: DbClient, table: string, column: string): Promise<boolean> {
  if (db.mode === 'sqlite') {
    const cols = await db.query<{ name: string }>(`PRAGMA table_info(${table})`);
    return cols.some((c) => c.name === column);
  }
  const row = await db.queryOne(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return Boolean(row);
}

async function addColumnIfMissing(
  db: DbClient,
  table: string,
  column: string,
  definitionSql: string
): Promise<void> {
  if (!(await hasColumn(db, table, column))) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definitionSql}`);
  }
}

export async function runMigrations(db: DbClient): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = await db.query<{ version: string }>(`SELECT version FROM schema_migrations`);
  const applied = new Set(appliedRows.map((r) => r.version));

  if (!applied.has('001_initial')) {
    await db.execute(`INSERT INTO schema_migrations (version) VALUES ('001_initial')`);
  }

  if (!applied.has('002_production_upgrade')) {
    await addColumnIfMissing(db, 'users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'users', 'locked_until', 'TEXT');

    await addColumnIfMissing(db, 'user_sessions', 'refresh_token_hash', 'TEXT');
    await addColumnIfMissing(db, 'user_sessions', 'refresh_family_id', 'TEXT');
    await addColumnIfMissing(db, 'user_sessions', 'rotated_at', 'TEXT');
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON user_sessions(refresh_token_hash)`
    );

    await addColumnIfMissing(db, 'banks', 'late_fee_slabs_json', 'TEXT');
    await addColumnIfMissing(db, 'banks', 'default_apr', 'REAL NOT NULL DEFAULT 42.0');
    await addColumnIfMissing(db, 'banks', 'gst_rate_pct', 'REAL NOT NULL DEFAULT 18.0');
    await addColumnIfMissing(db, 'banks', 'min_due_pct', 'REAL NOT NULL DEFAULT 5.0');
    await addColumnIfMissing(db, 'banks', 'min_due_floor', 'REAL NOT NULL DEFAULT 100.0');

    await addColumnIfMissing(db, 'bank_offers', 'source_url', 'TEXT');
    await addColumnIfMissing(
      db,
      'bank_offers',
      'verification_status',
      "TEXT NOT NULL DEFAULT 'demo'"
    );
    await addColumnIfMissing(db, 'bank_offers', 'last_verified_at', 'TEXT');
    await addColumnIfMissing(db, 'bank_offers', 'verified_by', 'TEXT');

    // In SQLite, if an older bank_offers table has a narrow CHECK constraint on category,
    // preserve existing rows while supporting all expanded categories via table rebuild if needed.
    if (db.mode === 'sqlite') {
      const schemaSqlRow = await db.queryOne<{ sql: string }>(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bank_offers'`
      );
      if (schemaSqlRow?.sql && !schemaSqlRow.sql.includes('No-cost EMI')) {
        await db.execute(`PRAGMA foreign_keys = OFF`);
        await db.execute(`PRAGMA legacy_alter_table = ON`);
        await db.transaction(async (tx) => {
          await tx.execute(`ALTER TABLE bank_offers RENAME TO bank_offers_old`);
          await tx.execute(`
            CREATE TABLE bank_offers (
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
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              source_url TEXT,
              verification_status TEXT NOT NULL DEFAULT 'demo',
              last_verified_at TEXT,
              verified_by TEXT
            )
          `);
          await tx.execute(`
            INSERT INTO bank_offers (
              id, user_id, bank_id, bank_name, title, applicable_cards, category, subcategory,
              merchant, discount_percentage, max_discount, min_transaction_amount,
              offer_validity, expiry_date, terms_and_conditions, offer_source, promo_code,
              is_active, created_at, source_url, verification_status, last_verified_at, verified_by
            )
            SELECT id, user_id, bank_id, bank_name, title, applicable_cards, category, subcategory,
              merchant, discount_percentage, max_discount, min_transaction_amount,
              offer_validity, expiry_date, terms_and_conditions, offer_source, promo_code,
              is_active, created_at, source_url,
              CASE WHEN offer_source = 'verified' THEN 'verified' WHEN offer_source = 'manual' THEN 'unverified' ELSE 'demo' END,
              last_verified_at, verified_by
            FROM bank_offers_old
          `);
          await tx.execute(`DROP TABLE bank_offers_old`);
          await tx.execute(
            `CREATE INDEX IF NOT EXISTS idx_offers_bank_cat ON bank_offers(bank_name, category, expiry_date)`
          );
        });
        await db.execute(`PRAGMA legacy_alter_table = OFF`);
        await db.execute(`PRAGMA foreign_keys = ON`);
      }
    }

    await addColumnIfMissing(
      db,
      'payment_reminders',
      'delivery_status',
      "TEXT NOT NULL DEFAULT 'Pending'"
    );
    await addColumnIfMissing(db, 'payment_reminders', 'retry_count', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'payment_reminders', 'last_error', 'TEXT');
    await addColumnIfMissing(db, 'payment_reminders', 'next_retry_at', 'TEXT');
    await addColumnIfMissing(
      db,
      'payment_reminders',
      'timezone',
      "TEXT NOT NULL DEFAULT 'Asia/Kolkata'"
    );

    await addColumnIfMissing(
      db,
      'user_preferences',
      'timezone',
      "TEXT NOT NULL DEFAULT 'Asia/Kolkata'"
    );

    await addColumnIfMissing(db, 'reward_points', 'total_cashback_inr', 'REAL NOT NULL DEFAULT 0');
    await addColumnIfMissing(
      db,
      'reward_transactions',
      'cashback_inr',
      'REAL NOT NULL DEFAULT 0'
    );

    await db.execute(`INSERT INTO schema_migrations (version) VALUES ('002_production_upgrade')`);
  }

  // Also repair any legacy SQLite databases where offer_bookmarks/card_offer_eligibility
  // had FK references rewritten to bank_offers_old during an earlier rename
  if (db.mode === 'sqlite') {
    const bmSql = await db.queryOne<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'offer_bookmarks'`
    );
    if (bmSql?.sql && bmSql.sql.includes('bank_offers_old')) {
      await db.execute(`PRAGMA foreign_keys = OFF`);
      await db.transaction(async (tx) => {
        await tx.execute(`ALTER TABLE offer_bookmarks RENAME TO offer_bookmarks_tmp`);
        await tx.execute(`
          CREATE TABLE offer_bookmarks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            offer_id TEXT NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, offer_id)
          )
        `);
        await tx.execute(`INSERT INTO offer_bookmarks SELECT * FROM offer_bookmarks_tmp`);
        await tx.execute(`DROP TABLE offer_bookmarks_tmp`);
      });
      await db.execute(`PRAGMA foreign_keys = ON`);
    }

    const eligSql = await db.queryOne<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'card_offer_eligibility'`
    );
    if (eligSql?.sql && eligSql.sql.includes('bank_offers_old')) {
      await db.execute(`PRAGMA foreign_keys = OFF`);
      await db.transaction(async (tx) => {
        await tx.execute(`ALTER TABLE card_offer_eligibility RENAME TO card_offer_eligibility_tmp`);
        await tx.execute(`
          CREATE TABLE card_offer_eligibility (
            id TEXT PRIMARY KEY,
            offer_id TEXT NOT NULL REFERENCES bank_offers(id) ON DELETE CASCADE,
            card_id TEXT REFERENCES credit_cards(id) ON DELETE CASCADE,
            bank_name TEXT NOT NULL,
            card_pattern TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `);
        await tx.execute(`INSERT INTO card_offer_eligibility SELECT * FROM card_offer_eligibility_tmp`);
        await tx.execute(`DROP TABLE card_offer_eligibility_tmp`);
      });
      await db.execute(`PRAGMA foreign_keys = ON`);
    }
  }
}

export async function applyBankCalculationDefaults(db: DbClient): Promise<void> {
  // Ensure bank-specific calculation rules are populated without overwriting admin edits
  for (const [bankName, cfg] of Object.entries(BANK_CALCULATION_DEFAULTS)) {
    await db.execute(
      `UPDATE banks SET
         late_fee_slabs_json = COALESCE(late_fee_slabs_json, $1),
         default_apr = CASE WHEN default_apr = 42.0 THEN $2 ELSE default_apr END,
         min_due_pct = COALESCE(min_due_pct, $3),
         min_due_floor = COALESCE(min_due_floor, $4)
       WHERE name = $5`,
      [JSON.stringify(cfg.slabs), cfg.defaultApr, cfg.minDuePct, cfg.minDueFloor, bankName]
    );
  }
}
