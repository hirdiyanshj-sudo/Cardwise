import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { ensureDemoUser, seedDemoPortfolioForUser } from '../db/seed.js';
import { env } from '../config/env.js';
import {
  hashPassword,
  verifyPassword,
  encryptSensitive,
  decryptSensitive,
  signJwt,
  verifyJwt,
  generateToken,
  hashToken,
  generateBase32Secret,
  verifyTotpCode,
} from '../utils/crypto.js';
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  parseCookies,
  setAuthCookies,
} from '../utils/cookies.js';
import { sendEmail, getRecentEmailPreviews } from '../utils/email.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { writeAuditLog } from '../middleware/security.js';

const router = Router();

const strictLoginLimiter = createRateLimiter(20, 15 * 60 * 1000, (req) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  return `login:${req.ip || 'local'}:${email}`;
});

async function createUserSessionAndSetCookies(
  userId: string,
  email: string,
  role: 'user' | 'admin',
  req: Request,
  res: Response
) {
  const db = getDb();
  const jti = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const refreshToken = generateToken(32);
  const csrfToken = generateToken(24);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const ua = String(req.headers['user-agent'] || 'Web Browser');
  const deviceLabel = ua.includes('Mobile')
    ? 'Mobile Browser'
    : ua.includes('Chrome')
      ? 'Chrome Desktop'
      : ua.includes('Edge')
        ? 'Edge Desktop'
        : 'Web Browser';

  await db.execute(
    `INSERT INTO user_sessions (
       id, user_id, token_jti, refresh_token_hash, refresh_family_id,
       device_label, ip_address, user_agent, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      crypto.randomUUID(),
      userId,
      jti,
      hashToken(refreshToken),
      familyId,
      deviceLabel,
      req.ip || '127.0.0.1',
      ua.slice(0, 200),
      expiresAt,
    ]
  );

  // Short-lived 15-minute access token + 7-day rotating refresh token
  const accessToken = signJwt({ sub: userId, email, role, jti }, 15 * 60);
  setAuthCookies(res, accessToken, refreshToken, csrfToken);

  return { accessToken, refreshToken, csrfToken, jti, expiresAt };
}

router.get('/csrf', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[CSRF_COOKIE_NAME] || generateToken(24);
  if (!cookies[CSRF_COOKIE_NAME]) {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: env.cookieSecure || env.nodeEnv === 'production',
      sameSite: env.nodeEnv === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  res.json({ csrfToken: token });
});

router.post('/register', strictLoginLimiter, async (req, res) => {
  const { fullName, email, mobileNumber, password, loadDemoData } = req.body || {};
  if (!fullName || !email || !password) {
    res.status(400).json({ error: 'Full name, email, and password are required.' });
    return;
  }
  const cleanEmail = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const db = getDb();
  const existing = await db.queryOne(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const verifyToken = generateToken(20);
  const passwordHash = hashPassword(String(password));
  const mobileClean = String(mobileNumber || '').trim();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO users (
        id, email, password_hash, full_name, mobile_number, role, auth_provider,
        email_verified, email_verification_token, is_active, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, 'user', 'email', 0, $6, 1, NOW())`,
      [userId, cleanEmail, passwordHash, String(fullName), mobileClean, hashToken(verifyToken)]
    );

    await tx.execute(
      `INSERT INTO user_profiles (id, user_id, full_name, mobile_encrypted, city)
       VALUES ($1, $2, $3, $4, 'Bengaluru')`,
      [
        crypto.randomUUID(),
        userId,
        String(fullName),
        mobileClean ? encryptSensitive(mobileClean) : null,
      ]
    );

    await tx.execute(
      `INSERT INTO user_preferences (id, user_id, theme, timezone) VALUES ($1, $2, 'dark', 'Asia/Kolkata')`,
      [crypto.randomUUID(), userId]
    );

    await tx.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, severity)
       VALUES ($1, $2, 'security', 'Welcome to CardWise!', 'Verify your email and enable 2FA in Profile & Settings for maximum account protection.', 'info')`,
      [crypto.randomUUID(), userId]
    );
  });

  if (loadDemoData) {
    await seedDemoPortfolioForUser(db, userId);
  }

  await sendEmail(
    cleanEmail,
    'Verify your CardWise email address',
    `<p>Hi ${String(fullName)},</p><p>Your verification token is: <strong>${verifyToken}</strong></p><p>Or click: <a href="${env.frontendUrl}/auth?verifyToken=${verifyToken}">Verify Email</a></p>`
  );

  const session = await createUserSessionAndSetCookies(userId, cleanEmail, 'user', req, res);
  await writeAuditLog(db, userId, 'USER_REGISTERED', 'users', userId, req, { email: cleanEmail });

  res.status(201).json({
    csrfToken: session.csrfToken,
    verificationTokenDev: env.nodeEnv !== 'production' ? verifyToken : undefined,
    user: {
      id: userId,
      email: cleanEmail,
      fullName: String(fullName),
      mobileNumber: mobileClean,
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    },
  });
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ error: 'Verification token is required.' });
    return;
  }
  const db = getDb();
  const hashed = hashToken(String(token));
  const user = await db.queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email_verification_token = $1`,
    [hashed]
  );
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired email verification token.' });
    return;
  }
  await db.execute(
    `UPDATE users SET email_verified = 1, email_verification_token = NULL, updated_at = NOW() WHERE id = $1`,
    [user.id]
  );
  await writeAuditLog(db, user.id, 'EMAIL_VERIFIED', 'users', user.id, req);
  res.json({ message: 'Email verified successfully.', emailVerified: true });
});

router.post('/resend-verification', requireAuth, async (req, res) => {
  const db = getDb();
  const verifyToken = generateToken(20);
  await db.execute(
    `UPDATE users SET email_verification_token = $1, updated_at = NOW() WHERE id = $2`,
    [hashToken(verifyToken), req.user!.id]
  );
  const delivery = await sendEmail(
    req.user!.email,
    'Verify your CardWise email address',
    `<p>Your verification token is: <strong>${verifyToken}</strong></p>`
  );
  res.json({
    message:
      delivery.deliveryStatus === 'Delivered'
        ? 'Verification email sent via SMTP.'
        : 'SMTP is not configured; verification email logged to preview inbox.',
    deliveryStatus: delivery.deliveryStatus,
    verificationTokenDev: env.nodeEnv !== 'production' ? verifyToken : undefined,
  });
});

router.post('/login', strictLoginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const cleanEmail = String(email).toLowerCase().trim();
  const db = getDb();
  const user = await db.queryOne<any>(`SELECT * FROM users WHERE email = $1`, [cleanEmail]);

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    await writeAuditLog(db, user.id, 'LOGIN_LOCKED', 'users', user.id, req, { email: cleanEmail });
    res.status(429).json({
      error: `Account temporarily locked due to repeated failed login attempts. Try again after ${env.loginLockoutMinutes} minutes.`,
    });
    return;
  }

  if (!user || !user.password_hash || !verifyPassword(String(password), user.password_hash)) {
    if (user) {
      const nextFails = Number(user.failed_login_attempts || 0) + 1;
      const lockUntil =
        nextFails >= env.loginMaxFailures
          ? new Date(Date.now() + env.loginLockoutMinutes * 60 * 1000).toISOString()
          : null;
      await db.execute(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [nextFails, lockUntil, user.id]
      );
    }
    await writeAuditLog(db, user?.id || null, 'LOGIN_FAILED', 'users', user?.id || null, req, {
      email: cleanEmail,
    });
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Account is deactivated.' });
    return;
  }

  await db.execute(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [user.id]
  );

  if (Boolean(user.mfa_enabled)) {
    const mfaToken = signJwt(
      { sub: user.id, email: user.email, role: user.role, jti: 'mfa-pending', mfaPending: true },
      300
    );
    res.json({ mfaRequired: true, mfaToken });
    return;
  }

  await db.execute(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  const session = await createUserSessionAndSetCookies(user.id, user.email, user.role, req, res);
  await writeAuditLog(db, user.id, 'LOGIN_SUCCESS', 'users', user.id, req);

  res.json({
    csrfToken: session.csrfToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      role: user.role,
      emailVerified: Boolean(user.email_verified),
      mfaEnabled: Boolean(user.mfa_enabled),
    },
  });
});

router.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const rawRefresh = cookies[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
  if (!rawRefresh) {
    res.status(401).json({ error: 'Refresh token missing.' });
    return;
  }

  const db = getDb();
  const hashed = hashToken(String(rawRefresh));
  const session = await db.queryOne<any>(
    `SELECT * FROM user_sessions WHERE refresh_token_hash = $1`,
    [hashed]
  );

  if (!session) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid refresh token.' });
    return;
  }

  // Refresh token reuse detection: if already revoked/rotated, invalidate entire token family!
  if (Boolean(session.is_revoked) || new Date(session.expires_at) < new Date()) {
    if (session.refresh_family_id) {
      await db.execute(
        `UPDATE user_sessions SET is_revoked = 1 WHERE refresh_family_id = $1`,
        [session.refresh_family_id]
      );
      await writeAuditLog(db, session.user_id, 'REFRESH_TOKEN_REUSE_DETECTED', 'user_sessions', session.id, req);
    }
    clearAuthCookies(res);
    res.status(401).json({ error: 'Session expired or revoked. Please sign in again.' });
    return;
  }

  const user = await db.queryOne<any>(
    `SELECT id, email, role, is_active FROM users WHERE id = $1`,
    [session.user_id]
  );
  if (!user || !user.is_active) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'User account inactive.' });
    return;
  }

  const newJti = crypto.randomUUID();
  const newRefresh = generateToken(32);
  const csrfToken = generateToken(24);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.transaction(async (tx) => {
    await tx.execute(
      `UPDATE user_sessions SET is_revoked = 1, rotated_at = NOW() WHERE id = $1`,
      [session.id]
    );
    await tx.execute(
      `INSERT INTO user_sessions (
         id, user_id, token_jti, refresh_token_hash, refresh_family_id,
         device_label, ip_address, user_agent, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        crypto.randomUUID(),
        user.id,
        newJti,
        hashToken(newRefresh),
        session.refresh_family_id || crypto.randomUUID(),
        session.device_label,
        req.ip || '127.0.0.1',
        session.user_agent,
        newExpiresAt,
      ]
    );
  });

  const accessToken = signJwt({ sub: user.id, email: user.email, role: user.role, jti: newJti }, 15 * 60);
  setAuthCookies(res, accessToken, newRefresh, csrfToken);

  res.json({ csrfToken, refreshed: true });
});

router.post('/demo-login', async (req, res) => {
  const db = getDb();
  const demoId = await ensureDemoUser(db);
  const user = await db.queryOne<any>(`SELECT * FROM users WHERE id = $1`, [demoId]);
  const session = await createUserSessionAndSetCookies(user.id, user.email, user.role, req, res);
  await writeAuditLog(db, user.id, 'DEMO_LOGIN', 'users', user.id, req);
  res.json({
    csrfToken: session.csrfToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      role: user.role,
      emailVerified: true,
      mfaEnabled: Boolean(user.mfa_enabled),
      isDemoAccount: true,
    },
  });
});

router.post('/google', strictLoginLimiter, async (req, res) => {
  const { idToken, email, fullName, googleId } = req.body || {};
  let verifiedEmail = '';
  let verifiedName = '';
  let verifiedGoogleId = '';

  if (env.googleClientId) {
    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required.' });
      return;
    }
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken))}`
      );
      if (!resp.ok) {
        res.status(401).json({ error: 'Invalid Google ID token.' });
        return;
      }
      const payload = (await resp.json()) as any;
      if (payload.aud !== env.googleClientId || payload.email_verified !== 'true') {
        res.status(401).json({ error: 'Google token audience or email verification failed.' });
        return;
      }
      verifiedEmail = String(payload.email || '').toLowerCase();
      verifiedName = String(payload.name || verifiedEmail.split('@')[0]);
      verifiedGoogleId = String(payload.sub);
    } catch {
      res.status(502).json({ error: 'Failed to verify Google ID token with Google.' });
      return;
    }
  } else if (env.nodeEnv !== 'production' && email) {
    verifiedEmail = String(email).toLowerCase().trim();
    verifiedName = String(fullName || verifiedEmail.split('@')[0]);
    verifiedGoogleId = String(googleId || `dev-google-${hashToken(verifiedEmail).slice(0, 16)}`);
  } else {
    res.status(503).json({
      error:
        'Google OAuth is not configured on this server (missing GOOGLE_CLIENT_ID). Please sign in with email and password.',
    });
    return;
  }

  const db = getDb();
  let user = await db.queryOne<any>(`SELECT * FROM users WHERE email = $1`, [verifiedEmail]);
  if (!user) {
    const userId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO users (id, email, full_name, role, auth_provider, google_id, email_verified, is_active, last_login_at)
         VALUES ($1, $2, $3, 'user', 'google', $4, 1, 1, NOW())`,
        [userId, verifiedEmail, verifiedName, verifiedGoogleId]
      );
      await tx.execute(
        `INSERT INTO user_profiles (id, user_id, full_name) VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), userId, verifiedName]
      );
      await tx.execute(
        `INSERT INTO user_preferences (id, user_id, theme, timezone) VALUES ($1, $2, 'dark', 'Asia/Kolkata')`,
        [crypto.randomUUID(), userId]
      );
    });
    user = await db.queryOne<any>(`SELECT * FROM users WHERE id = $1`, [userId]);
  } else {
    await db.execute(
      `UPDATE users SET google_id = COALESCE(google_id, $1), email_verified = 1, last_login_at = NOW() WHERE id = $2`,
      [verifiedGoogleId, user.id]
    );
  }

  const session = await createUserSessionAndSetCookies(user.id, user.email, user.role, req, res);
  await writeAuditLog(db, user.id, 'GOOGLE_LOGIN', 'users', user.id, req);

  res.json({
    csrfToken: session.csrfToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      role: user.role,
      emailVerified: true,
      mfaEnabled: Boolean(user.mfa_enabled),
    },
  });
});

router.post('/mfa/verify-login', strictLoginLimiter, async (req, res) => {
  const { mfaToken, code } = req.body || {};
  if (!mfaToken || !code) {
    res.status(400).json({ error: 'MFA token and 6-digit code are required.' });
    return;
  }
  const payload = verifyJwt(String(mfaToken));
  if (!payload || !payload.mfaPending) {
    res.status(401).json({ error: 'Invalid or expired MFA challenge.' });
    return;
  }
  const db = getDb();
  const user = await db.queryOne<any>(`SELECT * FROM users WHERE id = $1`, [payload.sub]);
  if (!user || !user.mfa_enabled || !user.mfa_secret_encrypted) {
    res.status(400).json({ error: 'MFA is not enabled on this account.' });
    return;
  }

  const secret = decryptSensitive(user.mfa_secret_encrypted);
  const backupHashes: string[] = user.mfa_backup_codes_hash
    ? JSON.parse(user.mfa_backup_codes_hash)
    : [];
  const codeTrimmed = String(code).trim();
  let valid = verifyTotpCode(secret, codeTrimmed);

  if (!valid && backupHashes.includes(hashToken(codeTrimmed))) {
    valid = true;
    const remaining = backupHashes.filter((h) => h !== hashToken(codeTrimmed));
    await db.execute(`UPDATE users SET mfa_backup_codes_hash = $1 WHERE id = $2`, [
      JSON.stringify(remaining),
      user.id,
    ]);
  }

  if (!valid) {
    await writeAuditLog(db, user.id, 'MFA_FAILED', 'users', user.id, req);
    res.status(401).json({ error: 'Invalid authenticator or backup code.' });
    return;
  }

  await db.execute(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  const session = await createUserSessionAndSetCookies(user.id, user.email, user.role, req, res);
  await writeAuditLog(db, user.id, 'LOGIN_MFA_SUCCESS', 'users', user.id, req);

  res.json({
    csrfToken: session.csrfToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      role: user.role,
      emailVerified: Boolean(user.email_verified),
      mfaEnabled: true,
    },
  });
});

router.post('/forgot-password', strictLoginLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }
  const cleanEmail = String(email).toLowerCase().trim();
  const db = getDb();
  const user = await db.queryOne<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM users WHERE email = $1`,
    [cleanEmail]
  );

  let resetTokenDev: string | undefined;
  if (user) {
    const resetToken = generateToken(20);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.execute(
      `UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
      [hashToken(resetToken), expires, user.id]
    );
    await sendEmail(
      cleanEmail,
      'CardWise Password Reset Request',
      `<p>Hi ${user.full_name},</p><p>Use this reset token within 30 minutes: <strong>${resetToken}</strong></p>`
    );
    await writeAuditLog(db, user.id, 'PASSWORD_RESET_REQUESTED', 'users', user.id, req);
    if (env.nodeEnv !== 'production') resetTokenDev = resetToken;
  }

  res.json({
    message: 'If an account matches that email, a password reset token has been issued.',
    resetTokenDev,
  });
});

router.post('/reset-password', strictLoginLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: 'Valid token and new password (min 8 chars) are required.' });
    return;
  }
  const db = getDb();
  const user = await db.queryOne<{ id: string; password_reset_expires_at: string }>(
    `SELECT id, password_reset_expires_at FROM users WHERE password_reset_token = $1`,
    [hashToken(String(token))]
  );
  if (!user || new Date(user.password_reset_expires_at) < new Date()) {
    res.status(400).json({ error: 'Invalid or expired password reset token.' });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2`,
      [hashPassword(String(newPassword)), user.id]
    );
    await tx.execute(`UPDATE user_sessions SET is_revoked = 1 WHERE user_id = $1`, [user.id]);
  });
  clearAuthCookies(res);
  await writeAuditLog(db, user.id, 'PASSWORD_RESET_COMPLETED', 'users', user.id, req);
  res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
});

router.post('/logout', requireAuth, async (req, res) => {
  const db = getDb();
  await db.execute(`UPDATE user_sessions SET is_revoked = 1 WHERE token_jti = $1 AND user_id = $2`, [
    req.user!.jti,
    req.user!.id,
  ]);
  clearAuthCookies(res);
  await writeAuditLog(db, req.user!.id, 'LOGOUT', 'user_sessions', req.user!.jti, req);
  res.json({ message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const db = getDb();
  const user = await db.queryOne<any>(
    `SELECT id, email, full_name, mobile_number, role, auth_provider, email_verified, mfa_enabled, last_login_at, created_at
     FROM users WHERE id = $1`,
    [req.user!.id]
  );
  const profile = await db.queryOne<any>(`SELECT * FROM user_profiles WHERE user_id = $1`, [
    req.user!.id,
  ]);
  const preferences = await db.queryOne<any>(`SELECT * FROM user_preferences WHERE user_id = $1`, [
    req.user!.id,
  ]);
  const unread = await db.queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM notifications WHERE user_id = $1 AND is_read = 0`,
    [req.user!.id]
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      role: user.role,
      authProvider: user.auth_provider,
      emailVerified: Boolean(user.email_verified),
      mfaEnabled: Boolean(user.mfa_enabled),
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      isDemoAccount: user.email === 'demo@cardwise.in',
    },
    profile: profile
      ? {
          city: profile.city,
          monthlyIncomeBracket: profile.monthly_income_bracket,
          creditScoreSelfReported: profile.credit_score_self_reported,
          preferredCurrency: profile.preferred_currency,
          privacyAnalyticsOptIn: Boolean(profile.privacy_analytics_opt_in),
          privacyMarketingOptIn: Boolean(profile.privacy_marketing_opt_in),
        }
      : null,
    preferences: preferences
      ? {
          theme: preferences.theme,
          timezone: preferences.timezone || 'Asia/Kolkata',
          notifyInApp: Boolean(preferences.notify_in_app),
          notifyEmail: Boolean(preferences.notify_email),
          notifyBrowser: Boolean(preferences.notify_browser),
          notifySms: Boolean(preferences.notify_sms),
          remind7Days: Boolean(preferences.remind_7_days),
          remind3Days: Boolean(preferences.remind_3_days),
          remind1Day: Boolean(preferences.remind_1_day),
          remindDueDate: Boolean(preferences.remind_due_date),
          remindOverdue: Boolean(preferences.remind_overdue),
          utilisationAlertThreshold: preferences.utilisation_alert_threshold,
        }
      : null,
    unreadNotifications: Number(unread?.c || 0),
    capabilities: {
      googleOAuthConfigured: Boolean(env.googleClientId),
      smtpConfigured: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
      nodeEnv: env.nodeEnv,
    },
  });
});

router.put('/profile', requireAuth, async (req, res) => {
  const {
    fullName,
    mobileNumber,
    city,
    monthlyIncomeBracket,
    creditScoreSelfReported,
    privacyAnalyticsOptIn,
    privacyMarketingOptIn,
  } = req.body || {};

  if (
    creditScoreSelfReported !== undefined &&
    creditScoreSelfReported !== '' &&
    (Number(creditScoreSelfReported) < 300 || Number(creditScoreSelfReported) > 900)
  ) {
    res.status(400).json({ error: 'Self-reported credit score must be between 300 and 900.' });
    return;
  }

  const db = getDb();
  if (fullName) {
    await db.execute(
      `UPDATE users SET full_name = $1, mobile_number = COALESCE($2, mobile_number), updated_at = NOW() WHERE id = $3`,
      [String(fullName), mobileNumber !== undefined ? String(mobileNumber) : null, req.user!.id]
    );
  }
  await db.execute(
    `UPDATE user_profiles SET
      full_name = COALESCE($1, full_name),
      mobile_encrypted = COALESCE($2, mobile_encrypted),
      city = COALESCE($3, city),
      monthly_income_bracket = COALESCE($4, monthly_income_bracket),
      credit_score_self_reported = COALESCE($5, credit_score_self_reported),
      privacy_analytics_opt_in = COALESCE($6, privacy_analytics_opt_in),
      privacy_marketing_opt_in = COALESCE($7, privacy_marketing_opt_in),
      updated_at = NOW()
     WHERE user_id = $8`,
    [
      fullName ? String(fullName) : null,
      mobileNumber ? encryptSensitive(String(mobileNumber)) : null,
      city ?? null,
      monthlyIncomeBracket ?? null,
      creditScoreSelfReported ? Number(creditScoreSelfReported) : null,
      privacyAnalyticsOptIn !== undefined ? (privacyAnalyticsOptIn ? 1 : 0) : null,
      privacyMarketingOptIn !== undefined ? (privacyMarketingOptIn ? 1 : 0) : null,
      req.user!.id,
    ]
  );

  await writeAuditLog(db, req.user!.id, 'PROFILE_UPDATED', 'user_profiles', req.user!.id, req);
  res.json({ message: 'Profile and privacy settings updated.' });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }
  const db = getDb();
  const user = await db.queryOne<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (user?.password_hash) {
    if (!currentPassword || !verifyPassword(String(currentPassword), user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
  }
  await db.execute(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    hashPassword(String(newPassword)),
    req.user!.id,
  ]);
  await db.execute(
    `UPDATE user_sessions SET is_revoked = 1 WHERE user_id = $1 AND token_jti != $2`,
    [req.user!.id, req.user!.jti]
  );
  await writeAuditLog(db, req.user!.id, 'PASSWORD_CHANGED', 'users', req.user!.id, req);
  res.json({ message: 'Password updated and other active sessions revoked.' });
});

router.post('/mfa/setup', requireAuth, async (req, res) => {
  const secret = generateBase32Secret(20);
  const backupCodes = Array.from({ length: 6 }, () => generateToken(4).toUpperCase());
  const db = getDb();
  await db.execute(
    `UPDATE users SET mfa_secret_encrypted = $1, mfa_backup_codes_hash = $2 WHERE id = $3`,
    [
      encryptSensitive(secret),
      JSON.stringify(backupCodes.map((c) => hashToken(c))),
      req.user!.id,
    ]
  );
  const otpauthUri = `otpauth://totp/CardWise:${encodeURIComponent(req.user!.email)}?secret=${secret}&issuer=CardWise`;
  res.json({ secret, otpauthUri, backupCodes });
});

router.post('/mfa/enable', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  const db = getDb();
  const user = await db.queryOne<{ mfa_secret_encrypted: string | null }>(
    `SELECT mfa_secret_encrypted FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (!user?.mfa_secret_encrypted) {
    res.status(400).json({ error: 'Please initiate MFA setup first.' });
    return;
  }
  const secret = decryptSensitive(user.mfa_secret_encrypted);
  if (!verifyTotpCode(secret, String(code || ''))) {
    res.status(400).json({ error: 'Invalid 6-digit authenticator code.' });
    return;
  }
  await db.execute(`UPDATE users SET mfa_enabled = 1, updated_at = NOW() WHERE id = $1`, [
    req.user!.id,
  ]);
  await writeAuditLog(db, req.user!.id, 'MFA_ENABLED', 'users', req.user!.id, req);
  res.json({ message: 'Two-factor authentication enabled.', mfaEnabled: true });
});

router.post('/mfa/disable', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const db = getDb();
  const user = await db.queryOne<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (user?.password_hash && (!password || !verifyPassword(String(password), user.password_hash))) {
    res.status(401).json({ error: 'Password confirmation failed.' });
    return;
  }
  await db.execute(
    `UPDATE users SET mfa_enabled = 0, mfa_secret_encrypted = NULL, mfa_backup_codes_hash = NULL WHERE id = $1`,
    [req.user!.id]
  );
  await writeAuditLog(db, req.user!.id, 'MFA_DISABLED', 'users', req.user!.id, req);
  res.json({ message: 'Two-factor authentication disabled.', mfaEnabled: false });
});

router.get('/sessions', requireAuth, async (req, res) => {
  const db = getDb();
  const sessions = await db.query<any>(
    `SELECT id, token_jti, device_label, ip_address, is_revoked, expires_at, last_active_at, created_at
     FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC LIMIT 20`,
    [req.user!.id]
  );
  res.json({
    sessions: sessions.map((s) => ({
      ...s,
      isCurrent: s.token_jti === req.user!.jti,
      isRevoked: Boolean(s.is_revoked),
    })),
  });
});

router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId);
  const db = getDb();
  await db.execute(`UPDATE user_sessions SET is_revoked = 1 WHERE id = $1 AND user_id = $2`, [
    sessionId,
    req.user!.id,
  ]);
  await writeAuditLog(db, req.user!.id, 'SESSION_REVOKED', 'user_sessions', sessionId, req);
  res.json({ message: 'Session revoked.' });
});

router.post('/load-demo-data', requireAuth, async (req, res) => {
  const db = getDb();
  await seedDemoPortfolioForUser(db, req.user!.id);
  await writeAuditLog(db, req.user!.id, 'DEMO_PORTFOLIO_LOADED', 'users', req.user!.id, req);
  res.json({ message: 'Sample Indian credit card demo portfolio loaded.' });
});

router.get('/audit-logs', requireAuth, async (req, res) => {
  const db = getDb();
  const logs = await db.query(
    `SELECT id, action, resource_type, resource_id, ip_address, details, created_at
     FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  );
  res.json({ logs });
});

router.get('/email-previews', requireAuth, async (req, res) => {
  if (env.nodeEnv === 'production') {
    res.json({ emails: [] });
    return;
  }
  res.json({ emails: getRecentEmailPreviews(req.user!.email) });
});

router.get('/export-data', requireAuth, async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const [user, profile, cards, statements, transactions, payments, rewards, budgets] =
    await Promise.all([
      db.queryOne(
        `SELECT id, email, full_name, mobile_number, created_at FROM users WHERE id = $1`,
        [uid]
      ),
      db.queryOne(
        `SELECT city, monthly_income_bracket, credit_score_self_reported, preferred_currency FROM user_profiles WHERE user_id = $1`,
        [uid]
      ),
      db.query(`SELECT * FROM credit_cards WHERE user_id = $1`, [uid]),
      db.query(`SELECT * FROM statements WHERE user_id = $1`, [uid]),
      db.query(`SELECT * FROM transactions WHERE user_id = $1`, [uid]),
      db.query(`SELECT * FROM payments WHERE user_id = $1`, [uid]),
      db.query(`SELECT * FROM reward_points WHERE user_id = $1`, [uid]),
      db.query(`SELECT * FROM budgets WHERE user_id = $1`, [uid]),
    ]);
  await writeAuditLog(db, uid, 'USER_DATA_EXPORTED', 'users', uid, req);
  res.setHeader('Content-Disposition', 'attachment; filename="cardwise-personal-data.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    notice: 'CardWise never stores complete card numbers, CVV, PIN, or OTPs.',
    user,
    profile,
    cards,
    statements,
    transactions,
    payments,
    rewards,
    budgets,
  });
});

router.delete('/account', requireAuth, async (req, res) => {
  const { password, confirmText } = req.body || {};
  if (confirmText !== 'DELETE') {
    res.status(400).json({ error: 'Type DELETE to confirm permanent account deletion.' });
    return;
  }
  const db = getDb();
  const user = await db.queryOne<{ password_hash: string | null; email: string }>(
    `SELECT password_hash, email FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (user?.password_hash && user.email !== 'demo@cardwise.in') {
    if (!password || !verifyPassword(String(password), user.password_hash)) {
      res.status(401).json({ error: 'Password verification failed.' });
      return;
    }
  }
  await writeAuditLog(db, req.user!.id, 'ACCOUNT_DELETED', 'users', req.user!.id, req);
  await db.execute(`DELETE FROM users WHERE id = $1`, [req.user!.id]);
  clearAuthCookies(res);
  res.json({ message: 'Account and all personal financial records permanently deleted.' });
});

export default router;
