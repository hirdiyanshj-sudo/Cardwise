import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { env } from '../config/env.js';
import { initSqliteSchema } from './sqlite-init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DbClient {
  mode: 'sqlite' | 'postgres';
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
}

function normalizeValueForSqlite(v: unknown): string | number | bigint | Uint8Array | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && !(v instanceof Uint8Array)) return JSON.stringify(v);
  return v as string | number | bigint | Uint8Array;
}

function adaptSqlForSqlite(sql: string, params: unknown[] = []): { sql: string; params: Array<string | number | bigint | Uint8Array | null> } {
  const expandedParams: Array<string | number | bigint | Uint8Array | null> = [];
  let adapted = sql
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\bTRUE\b/g, '1')
    .replace(/\bFALSE\b/g, '0')
    .replace(/::[a-zA-Z0-9_]+/g, '');

  adapted = adapted.replace(/\$(\d+)/g, (_match, numStr) => {
    const idx = Number(numStr) - 1;
    expandedParams.push(normalizeValueForSqlite(params[idx]));
    return '?';
  });

  return { sql: adapted, params: expandedParams };
}

let sqliteInstance: DatabaseSync | null = null;
let pgPool: pg.Pool | null = null;

function getSqliteDb(dbPath?: string): DatabaseSync {
  if (!sqliteInstance) {
    const targetPath =
      dbPath ||
      process.env.SQLITE_DB_PATH ||
      path.resolve(__dirname, '../../data/cardwise.db');
    if (targetPath !== ':memory:') {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    }
    sqliteInstance = new DatabaseSync(targetPath);
    initSqliteSchema(sqliteInstance);
  }
  return sqliteInstance;
}

function createSqliteClient(sqlite: DatabaseSync): DbClient {
  return {
    mode: 'sqlite',
    async query<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const { sql: adapted, params: bound } = adaptSqlForSqlite(sql, params);
      const stmt = sqlite.prepare(adapted);
      return stmt.all(...bound) as unknown as T[];
    },
    async queryOne<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T | null> {
      const { sql: adapted, params: bound } = adaptSqlForSqlite(sql, params);
      const stmt = sqlite.prepare(adapted);
      const row = stmt.get(...bound) as unknown as T | undefined;
      return row ?? null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const { sql: adapted, params: bound } = adaptSqlForSqlite(sql, params);
      const stmt = sqlite.prepare(adapted);
      const res = stmt.run(...bound);
      return { changes: Number(res.changes || 0) };
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      sqlite.exec('BEGIN');
      try {
        const result = await fn(this);
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

function createPgClient(poolOrClient: pg.Pool | pg.PoolClient, isPool = false): DbClient {
  return {
    mode: 'postgres',
    async query<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const res = await poolOrClient.query(sql, params);
      return res.rows as T[];
    },
    async queryOne<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T | null> {
      const res = await poolOrClient.query(sql, params);
      return (res.rows[0] as T) ?? null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const res = await poolOrClient.query(sql, params);
      return { changes: res.rowCount ?? 0 };
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      if (isPool) {
        const pool = poolOrClient as pg.Pool;
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(createPgClient(client, false));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
      return fn(this);
    },
  };
}

let cachedDb: DbClient | null = null;

export function getDb(customSqlitePath?: string): DbClient {
  if (customSqlitePath) {
    sqliteInstance = null;
    cachedDb = createSqliteClient(getSqliteDb(customSqlitePath));
    return cachedDb;
  }
  if (cachedDb) return cachedDb;

  if (env.databaseUrl) {
    pgPool = new pg.Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });
    cachedDb = createPgClient(pgPool, true);
  } else {
    cachedDb = createSqliteClient(getSqliteDb());
  }
  return cachedDb;
}
