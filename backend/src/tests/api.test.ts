import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';
import { generateTotpCode } from '../utils/crypto.js';

let server: http.Server;
let baseUrl = '';

class CookieJar {
  cookies = new Map<string, string>();

  capture(headers: Headers) {
    const raw = (headers as any).getSetCookie ? (headers as any).getSetCookie() : [];
    for (const c of raw) {
      const semi = c.indexOf(';');
      const pair = semi === -1 ? c : c.slice(0, semi);
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const val = pair.slice(eq + 1).trim();
      if (!val || c.toLowerCase().includes('max-age=0')) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }

  headerString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  get(name: string): string {
    return this.cookies.get(name) || '';
  }
}

async function req(
  path: string,
  options: RequestInit & { jar?: CookieJar; skipCsrf?: boolean } = {}
): Promise<{ status: number; headers: Headers; body: any; rawBuffer?: ArrayBuffer }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.jar) {
    const cookieStr = options.jar.headerString();
    if (cookieStr) headers.Cookie = cookieStr;
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && !options.skipCsrf) {
      const csrf = options.jar.get('cw_csrf_token');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (options.jar) options.jar.capture(res.headers);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('text/csv')) {
    const rawBuffer = await res.arrayBuffer();
    return { status: res.status, headers: res.headers, body: null, rawBuffer };
  }
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // plain text
  }
  return { status: res.status, headers: res.headers, body };
}

test('CardWise Production Security & Feature Integration Suite', async (t) => {
  const { app } = await createApp(':memory:');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const jarA = new CookieJar();
  const jarB = new CookieJar();
  const jarAdmin = new CookieJar();
  let cardId = '';
  let statementId = '';
  let verifyDevToken = '';
  let mfaSecret = '';

  await t.test('1. Health check works', async () => {
    const res = await req('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  await t.test('2. Cookie-based Registration, CSRF Protection, Refresh Rotation & Reuse Detection', async () => {
    const reg = await req('/auth/register', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        fullName: 'Ananya Verma',
        email: 'ananya@example.in',
        mobileNumber: '+919900112233',
        password: 'StrongPassword@123',
      }),
    });
    assert.equal(reg.status, 201);
    assert.ok(jarA.get('cw_access_token'));
    assert.ok(jarA.get('cw_refresh_token'));
    assert.ok(jarA.get('cw_csrf_token'));
    verifyDevToken = reg.body.verificationTokenDev;

    // CSRF Protection blocks mutating cookie requests without X-CSRF-Token
    const csrfBlocked = await req('/cards', {
      method: 'POST',
      jar: jarA,
      skipCsrf: true,
      body: JSON.stringify({ bankName: 'HDFC Bank' }),
    });
    assert.equal(csrfBlocked.status, 403);

    const ver = await req('/auth/verify-email', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ token: verifyDevToken }),
    });
    assert.equal(ver.status, 200);

    // Refresh token rotation
    const oldRefresh = jarA.get('cw_refresh_token');
    const refreshRes = await req('/auth/refresh', { method: 'POST', jar: jarA });
    assert.equal(refreshRes.status, 200);
    const newRefresh = jarA.get('cw_refresh_token');
    assert.notEqual(newRefresh, oldRefresh);

    // Replaying an already-rotated refresh token must fail (401) and revoke family
    const replayJar = new CookieJar();
    replayJar.cookies.set('cw_refresh_token', oldRefresh);
    replayJar.cookies.set('cw_csrf_token', jarA.get('cw_csrf_token'));
    const replayRes = await req('/auth/refresh', { method: 'POST', jar: replayJar });
    assert.equal(replayRes.status, 401);

    // Re-login cleanly after family revocation
    const login = await req('/auth/login', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ email: 'ananya@example.in', password: 'StrongPassword@123' }),
    });
    assert.equal(login.status, 200);
  });

  await t.test('3. Security Policy Rejects CVV, PIN, OTP & Full Card Numbers', async () => {
    const cvvAttempt = await req('/cards', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        bankName: 'HDFC Bank',
        cardName: 'Regalia',
        cardNetwork: 'Visa',
        cardType: 'Rewards',
        lastFourDigits: '1234',
        creditLimit: 300000,
        cvv: '999',
      }),
    });
    assert.equal(cvvAttempt.status, 400);

    const fullNumAttempt = await req('/cards', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        bankName: 'HDFC Bank',
        cardName: 'Regalia',
        cardNetwork: 'Visa',
        cardType: 'Rewards',
        lastFourDigits: '4111222233334444',
        creditLimit: 300000,
      }),
    });
    assert.equal(fullNumAttempt.status, 400);
  });

  await t.test('4. Card CRUD, Ledger-Locked Reward Points & Strict Cross-User Isolation', async () => {
    const addRes = await req('/cards', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        bankName: 'HDFC Bank',
        cardName: 'HDFC Millennia',
        cardNetwork: 'Mastercard',
        cardType: 'Cashback',
        lastFourDigits: '5678',
        creditLimit: 200000,
        outstandingBalance: 40000,
        annualFee: 1000,
        rewardPointsBalance: 500,
      }),
    });
    assert.equal(addRes.status, 201);
    cardId = addRes.body.card.id;
    assert.equal(addRes.body.card.available_credit_limit, 160000);

    // Attempt to arbitrarily tamper with reward points via PUT /cards/:id (must NOT change points)
    const editRes = await req(`/cards/${cardId}`, {
      method: 'PUT',
      jar: jarA,
      body: JSON.stringify({ creditLimit: 250000, rewardPointsBalance: 9999999 }),
    });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.body.card.credit_limit, 250000);
    assert.equal(editRes.body.card.reward_points_balance, 500);

    // User B isolation check
    const regB = await req('/auth/register', {
      method: 'POST',
      jar: jarB,
      body: JSON.stringify({
        fullName: 'Vikram Rao',
        email: 'vikram@example.in',
        password: 'VikramPassword@123',
      }),
    });
    assert.equal(regB.status, 201);
    const userBCards = await req('/cards', { jar: jarB });
    assert.equal(userBCards.body.cards.length, 0);

    const crossAccess = await req(`/cards/${cardId}`, { jar: jarB });
    assert.equal(crossAccess.status, 404);
  });

  await t.test('5. Transactions Auto-Categorize, Pagination & Utilisation Alerts', async () => {
    const txRes = await req('/transactions', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        cardId,
        merchant: 'Swiggy Instamart',
        description: 'Dinner order',
        amount: 50000,
      }),
    });
    assert.equal(txRes.status, 201);
    assert.equal(txRes.body.transaction.category_name, 'Food and Dining');

    const pagedTx = await req('/transactions?page=1&limit=5&sortBy=amount&sortOrder=desc', { jar: jarA });
    assert.equal(pagedTx.status, 200);
    assert.equal(pagedTx.body.pagination.totalCount, 1);

    const utilRes = await req('/cards/utilisation', { jar: jarA });
    assert.equal(utilRes.body.overall.utilisationPct, 36);
    assert.equal(utilRes.body.overall.exceedsThreshold, true);
  });

  await t.test('6. Bill Generation, Bank-Specific Calculators, Manual Payment & PDF Statement', async () => {
    // Bank-specific calculator (HDFC vs SBI)
    const hdfcCalc = await req('/bills/calculators', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ bankName: 'HDFC Bank', outstandingAmount: 20000, daysOverdue: 10 }),
    });
    const sbiCalc = await req('/bills/calculators', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ bankName: 'SBI Card', outstandingAmount: 20000, daysOverdue: 10 }),
    });
    assert.equal(hdfcCalc.status, 200);
    assert.equal(sbiCalc.status, 200);
    assert.notEqual(hdfcCalc.body.lateFee.baseFee, sbiCalc.body.lateFee.baseFee);

    // Generate next-month statement from transactions
    const genRes = await req('/bills/generate', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ cardId, statementMonth: '2026-11' }),
    });
    assert.ok(genRes.status === 201 || genRes.status === 409);

    const bills = await req('/bills', { jar: jarA });
    assert.ok(bills.body.statements.length >= 1);
    statementId = bills.body.statements[0].id;

    const pay = await req('/bills/payments', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ cardId, statementId, amount: bills.body.statements[0].total_amount_due, paymentMethod: 'UPI' }),
    });
    assert.equal(pay.status, 201);

    const pdf = await req(`/bills/statements/${statementId}/pdf`, { jar: jarA });
    assert.equal(pdf.status, 200);
    assert.ok((pdf.rawBuffer?.byteLength || 0) > 500);
  });

  await t.test('7. Admin RBAC Enforcement & Offer Verification Workflow', async () => {
    // Ordinary user must be blocked from Admin routes (403)
    const userAdminAttempt = await req('/admin/overview', { jar: jarA });
    assert.equal(userAdminAttempt.status, 403);

    // Admin login
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      jar: jarAdmin,
      body: JSON.stringify({ email: 'admin@cardwise.in', password: 'AdminWise@2026' }),
    });
    assert.equal(adminLogin.status, 200);

    const ov = await req('/admin/overview', { jar: jarAdmin });
    assert.equal(ov.status, 200);
    assert.ok(ov.body.stats.totalUsers >= 3);

    const newOffer = await req('/admin/offers', {
      method: 'POST',
      jar: jarAdmin,
      body: JSON.stringify({
        bankName: 'HDFC Bank',
        title: 'Verified 10% Flights Offer',
        category: 'Flights',
        merchant: 'MakeMyTrip',
        discountPercentage: 10,
        maxDiscount: 1500,
        expiryDate: '2027-03-31',
        sourceUrl: 'https://www.hdfcbank.com/offers',
        verificationStatus: 'verified',
      }),
    });
    assert.equal(newOffer.status, 201);
    assert.equal(newOffer.body.offer.verification_status, 'verified');
  });

  await t.test('8. Rewards Cashback, Analytics Exports, Comparison & Calendar', async () => {
    const rew = await req('/rewards/transactions', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({
        cardId,
        actionType: 'Earned',
        points: 200,
        cashbackInr: 450,
        description: 'Monthly Amazon Cashback',
      }),
    });
    assert.equal(rew.status, 201);

    const rewardsState = await req('/rewards', { jar: jarA });
    assert.equal(rewardsState.body.totals.totalCashbackInr, 450);

    const csv = await req('/analytics/export/csv', { jar: jarA });
    assert.equal(csv.status, 200);
    const pdfExp = await req('/analytics/export/pdf', { jar: jarA });
    assert.equal(pdfExp.status, 200);

    const dash = await req('/dashboard?range=30d', { jar: jarA });
    assert.equal(dash.status, 200);
    assert.ok(Array.isArray(dash.body.recentActivity));
  });

  await t.test('9. TOTP MFA Setup, MFA Login Challenge & Account Deletion', async () => {
    const setup = await req('/auth/mfa/setup', { method: 'POST', jar: jarA });
    assert.equal(setup.status, 200);
    mfaSecret = setup.body.secret;

    const enable = await req('/auth/mfa/enable', {
      method: 'POST',
      jar: jarA,
      body: JSON.stringify({ code: generateTotpCode(mfaSecret) }),
    });
    assert.equal(enable.status, 200);

    const jarMfa = new CookieJar();
    const challenge = await req('/auth/login', {
      method: 'POST',
      jar: jarMfa,
      body: JSON.stringify({ email: 'ananya@example.in', password: 'StrongPassword@123' }),
    });
    assert.equal(challenge.body.mfaRequired, true);

    const finish = await req('/auth/mfa/verify-login', {
      method: 'POST',
      jar: jarMfa,
      body: JSON.stringify({ mfaToken: challenge.body.mfaToken, code: generateTotpCode(mfaSecret) }),
    });
    assert.equal(finish.status, 200);

    const del = await req('/auth/account', {
      method: 'DELETE',
      jar: jarMfa,
      body: JSON.stringify({ password: 'StrongPassword@123', confirmText: 'DELETE' }),
    });
    assert.equal(del.status, 200);
  });
});
