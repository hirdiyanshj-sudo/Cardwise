import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEV_JWT_PLACEHOLDER = 'cardwise-dev-only-jwt-secret-change-in-production-9f8e7d6c5b4a';
const DEV_ENC_PLACEHOLDER = 'cardwise-dev-only-aes256-key-change-in-production-32b';

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  trustProxy: process.env.TRUST_PROXY === 'true',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || DEV_JWT_PLACEHOLDER,
  encryptionKey: process.env.ENCRYPTION_KEY || DEV_ENC_PLACEHOLDER,
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@cardwise.in',
  adminBootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL || '',
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD || '',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
  loginMaxFailures: Number(process.env.LOGIN_MAX_FAILURES || 10),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES || 15),
};

export function validateProductionEnv(): void {
  if (env.nodeEnv !== 'production') return;

  const errors: string[] = [];
  if (!process.env.JWT_SECRET || env.jwtSecret === DEV_JWT_PLACEHOLDER || env.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be explicitly set in production and at least 32 characters long.');
  }
  if (
    !process.env.ENCRYPTION_KEY ||
    env.encryptionKey === DEV_ENC_PLACEHOLDER ||
    env.encryptionKey.length < 32
  ) {
    errors.push('ENCRYPTION_KEY must be explicitly set in production and at least 32 characters long.');
  }
  if (!env.frontendUrl || env.frontendUrl === '*') {
    errors.push('FRONTEND_URL must be set to a specific origin in production (cannot be wildcard *).');
  }
  if (errors.length > 0) {
    throw new Error(`Production startup aborted due to insecure configuration:\n- ${errors.join('\n- ')}`);
  }
}
