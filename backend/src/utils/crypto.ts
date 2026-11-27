import crypto from 'node:crypto';
import { env } from '../config/env.js';

// ============================================================================
// Password Hashing (scrypt with random 16-byte salt & timing-safe check)
// ============================================================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

// ============================================================================
// AES-256-GCM Encryption for sensitive PII & MFA secrets at rest
// ============================================================================
function getAesKey(): Buffer {
  return crypto.createHash('sha256').update(env.encryptionKey).digest();
}

export function encryptSensitive(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !encHex) return '';
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getAesKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

// ============================================================================
// JWT Signing & Verification (HS256, zero external dependencies)
// ============================================================================
export interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  jti: string;
  iat: number;
  exp: number;
  mfaPending?: boolean;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds = 7 * 24 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', env.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function generateToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// RFC 6238 TOTP Multi-Factor Authentication
// ============================================================================
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpCode(secret: string, windowOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(secret, offset) === trimmed) return true;
  }
  return false;
}
