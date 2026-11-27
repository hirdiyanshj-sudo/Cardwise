import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/security.js';
import { calculateUtilisationPct } from '../utils/calculators.js';

const router = Router();

router.get('/banks', async (_req, res) => {
  const db = getDb();
  const banks = await db.query(`SELECT * FROM banks WHERE is_active = 1 ORDER BY name ASC`);
  res.json({ banks });
});

router.get('/catalog', async (_req, res) => {
  const db = getDb();
  const catalog = await db.query(`SELECT * FROM card_catalog ORDER BY bank_name ASC, card_name ASC`);
  res.json({ catalog });
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const cards = await db.query<any>(
    `SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );
  res.json({
    cards: cards.map((c) => ({
      ...c,
      utilisation_pct: calculateUtilisationPct(Number(c.used_credit_limit), Number(c.credit_limit)),
      is_demo: Boolean(c.is_demo),
    })),
  });
});

router.get('/utilisation', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const cards = await db.query<any>(`SELECT * FROM credit_cards WHERE user_id = $1`, [uid]);
  const prefs = await db.queryOne<{ utilisation_alert_threshold: number }>(
    `SELECT utilisation_alert_threshold FROM user_preferences WHERE user_id = $1`,
    [uid]
  );
  const threshold = Number(prefs?.utilisation_alert_threshold || 30);

  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const totalUsed = cards.reduce((s, c) => s + Number(c.used_credit_limit), 0);
  const totalAvailable = cards.reduce((s, c) => s + Number(c.available_credit_limit), 0);
  const overallPct = calculateUtilisationPct(totalUsed, totalLimit);

  const perCard = cards.map((c) => {
    const pct = calculateUtilisationPct(Number(c.used_credit_limit), Number(c.credit_limit));
    const availPct = calculateUtilisationPct(Number(c.available_credit_limit), Number(c.credit_limit));
    return {
      id: c.id,
      bankName: c.bank_name,
      cardName: c.card_name,
      lastFourDigits: c.last_four_digits,
      creditLimit: Number(c.credit_limit),
      usedLimit: Number(c.used_credit_limit),
      availableLimit: Number(c.available_credit_limit),
      utilisationPct: pct,
      exceedsThreshold: pct > threshold,
      lowAvailableCredit: availPct < 20,
    };
  });

  const monthlyRows = await db.query<{ month: string; total: number }>(
    `SELECT substr(transaction_date, 1, 7) AS month, SUM(amount) AS total
     FROM transactions WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI')
     GROUP BY substr(transaction_date, 1, 7) ORDER BY month ASC LIMIT 6`,
    [uid]
  );
  const history = monthlyRows.map((m) => ({
    month: m.month,
    spend: Number(m.total),
    utilisationPct: calculateUtilisationPct(Number(m.total), totalLimit || 1),
  }));

  res.json({
    threshold,
    overall: {
      totalLimit,
      totalUsed,
      totalAvailable,
      utilisationPct: overallPct,
      exceedsThreshold: overallPct > threshold,
    },
    cards: perCard,
    history,
  });
});

router.get('/:id', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const card = await db.queryOne<any>(
    `SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`,
    [req.params.id, uid]
  );
  if (!card) {
    res.status(404).json({ error: 'Credit card not found.' });
    return;
  }

  const [transactions, statements, payments, rewardSummary] = await Promise.all([
    db.query(
      `SELECT * FROM transactions WHERE card_id = $1 AND user_id = $2 ORDER BY transaction_date DESC LIMIT 50`,
      [card.id, uid]
    ),
    db.query(
      `SELECT * FROM statements WHERE card_id = $1 AND user_id = $2 ORDER BY statement_generation_date DESC LIMIT 12`,
      [card.id, uid]
    ),
    db.query(
      `SELECT * FROM payments WHERE card_id = $1 AND user_id = $2 ORDER BY payment_date DESC LIMIT 20`,
      [card.id, uid]
    ),
    db.queryOne(`SELECT * FROM reward_points WHERE card_id = $1 AND user_id = $2`, [card.id, uid]),
  ]);

  res.json({
    card: {
      ...card,
      utilisation_pct: calculateUtilisationPct(Number(card.used_credit_limit), Number(card.credit_limit)),
      is_demo: Boolean(card.is_demo),
    },
    transactions,
    statements,
    payments,
    rewardSummary,
  });
});

router.post('/', async (req, res) => {
  const {
    bankName,
    cardName,
    cardNetwork,
    cardType,
    lastFourDigits,
    creditLimit,
    outstandingBalance = 0,
    minimumAmountDue,
    interestRate,
    annualFee = 0,
    joiningFee = 0,
    billingCycle = '16th - 15th',
    statementGenerationDay = 15,
    paymentDueDay = 5,
    statementGenerationDate,
    paymentDueDate,
    rewardPointsBalance = 0,
    rewardPointValueInr = 0.25,
    cardStatus = 'Active',
    cardColorTheme = 'navy-gold',
  } = req.body || {};

  if (!bankName || !cardName || !cardNetwork || !cardType || !lastFourDigits || !creditLimit) {
    res.status(400).json({ error: 'Required card fields are missing.' });
    return;
  }
  if (!/^\d{4}$/.test(String(lastFourDigits))) {
    res.status(400).json({ error: 'Last four digits must be exactly 4 numeric digits.' });
    return;
  }
  const limitNum = Number(creditLimit);
  const outstandingNum = Math.max(0, Number(outstandingBalance || 0));
  const initialPoints = Math.max(0, Math.round(Number(rewardPointsBalance || 0)));
  if (isNaN(limitNum) || limitNum <= 0) {
    res.status(400).json({ error: 'Credit limit must be greater than 0.' });
    return;
  }

  const db = getDb();
  const bank = await db.queryOne<{ id: string; default_apr: number; min_due_pct: number; min_due_floor: number }>(
    `SELECT id, default_apr, min_due_pct, min_due_floor FROM banks WHERE name = $1`,
    [bankName]
  );

  const cardId = crypto.randomUUID();
  const available = Math.max(0, limitNum - outstandingNum);
  const minDuePct = Number(bank?.min_due_pct || 5) / 100;
  const minDueFloor = Number(bank?.min_due_floor || 100);
  const minDue =
    minimumAmountDue !== undefined && minimumAmountDue !== ''
      ? Number(minimumAmountDue)
      : outstandingNum === 0
        ? 0
        : Math.min(outstandingNum, Math.max(minDueFloor, Math.round(outstandingNum * minDuePct * 100) / 100));

  const resolvedApr =
    interestRate !== undefined && interestRate !== ''
      ? Number(interestRate)
      : Number(bank?.default_apr || 42.0);

  const today = new Date();
  const stmtDate =
    statementGenerationDate ||
    new Date(today.getFullYear(), today.getMonth(), Number(statementGenerationDay)).toISOString().slice(0, 10);
  const dueDateObj = new Date(today.getFullYear(), today.getMonth() + 1, Number(paymentDueDay));
  const dueDate = paymentDueDate || dueDateObj.toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO credit_cards (
        id, user_id, bank_id, bank_name, card_name, card_network, card_type,
        last_four_digits, credit_limit, available_credit_limit, used_credit_limit,
        outstanding_balance, minimum_amount_due, interest_rate, annual_fee, joining_fee,
        billing_cycle, statement_generation_day, payment_due_day,
        statement_generation_date, payment_due_date, reward_points_balance,
        reward_point_value_inr, card_status, card_color_theme, is_demo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,0)`,
      [
        cardId,
        req.user!.id,
        bank?.id ?? null,
        bankName,
        cardName,
        cardNetwork,
        cardType,
        String(lastFourDigits),
        limitNum,
        available,
        outstandingNum,
        outstandingNum,
        minDue,
        resolvedApr,
        Number(annualFee),
        Number(joiningFee),
        billingCycle,
        Number(statementGenerationDay),
        Number(paymentDueDay),
        stmtDate,
        dueDate,
        initialPoints,
        Number(rewardPointValueInr),
        cardStatus,
        cardColorTheme,
      ]
    );

    await tx.execute(
      `INSERT INTO reward_points (
        id, user_id, card_id, total_earned, current_balance, conversion_rate_inr
      ) VALUES ($1, $2, $3, $4, $4, $5)`,
      [
        crypto.randomUUID(),
        req.user!.id,
        cardId,
        initialPoints,
        Number(rewardPointValueInr),
      ]
    );

    if (initialPoints > 0) {
      await tx.execute(
        `INSERT INTO reward_transactions (id, user_id, card_id, action_type, points, inr_value, description)
         VALUES ($1,$2,$3,'Earned',$4,$5,$6)`,
        [
          crypto.randomUUID(),
          req.user!.id,
          cardId,
          initialPoints,
          Math.round(initialPoints * Number(rewardPointValueInr) * 100) / 100,
          `Opening reward balance for ${cardName}`,
        ]
      );
    }

    if (outstandingNum > 0) {
      await tx.execute(
        `INSERT INTO statements (
          id, user_id, card_id, statement_month, billing_period,
          statement_generation_date, payment_due_date, new_charges, total_amount_due,
          minimum_amount_due, amount_paid, payment_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,0,'Pending')`,
        [
          crypto.randomUUID(),
          req.user!.id,
          cardId,
          today.toISOString().slice(0, 7),
          billingCycle,
          stmtDate,
          dueDate,
          outstandingNum,
          minDue,
        ]
      );
    }
  });

  if (calculateUtilisationPct(outstandingNum, limitNum) > 30) {
    await db.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
       VALUES ($1,$2,'high_utilisation',$3,$4,'warning',$5)`,
      [
        crypto.randomUUID(),
        req.user!.id,
        `High Utilisation Alert: ${cardName}`,
        `Initial utilisation is ${calculateUtilisationPct(outstandingNum, limitNum)}%, above the recommended 30% threshold.`,
        cardId,
      ]
    );
  }

  await writeAuditLog(db, req.user!.id, 'CARD_ADDED', 'credit_cards', cardId, req, {
    bankName,
    lastFourDigits,
  });

  const created = await db.queryOne(`SELECT * FROM credit_cards WHERE id = $1`, [cardId]);
  res.status(201).json({ card: created });
});

router.put('/:id', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const existing = await db.queryOne<any>(
    `SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`,
    [req.params.id, uid]
  );
  if (!existing) {
    res.status(404).json({ error: 'Credit card not found.' });
    return;
  }

  const b = req.body || {};
  if (b.lastFourDigits && !/^\d{4}$/.test(String(b.lastFourDigits))) {
    res.status(400).json({ error: 'Last four digits must be 4 numeric digits.' });
    return;
  }

  const newLimit = b.creditLimit !== undefined ? Number(b.creditLimit) : Number(existing.credit_limit);
  const newOutstanding =
    b.outstandingBalance !== undefined ? Number(b.outstandingBalance) : Number(existing.outstanding_balance);
  const newAvailable = Math.max(0, newLimit - newOutstanding);
  const newMinDue =
    b.minimumAmountDue !== undefined
      ? Number(b.minimumAmountDue)
      : Math.round(newOutstanding * 0.05 * 100) / 100;

  // Note: reward_points_balance is derived from reward_transactions and cannot be arbitrarily overwritten here
  await db.execute(
    `UPDATE credit_cards SET
      bank_name = $1,
      card_name = $2,
      card_network = $3,
      card_type = $4,
      last_four_digits = $5,
      credit_limit = $6,
      available_credit_limit = $7,
      used_credit_limit = $8,
      outstanding_balance = $8,
      minimum_amount_due = $9,
      interest_rate = $10,
      annual_fee = $11,
      joining_fee = $12,
      billing_cycle = $13,
      statement_generation_date = $14,
      payment_due_date = $15,
      card_status = $16,
      card_color_theme = $17,
      updated_at = NOW()
     WHERE id = $18 AND user_id = $19`,
    [
      b.bankName ?? existing.bank_name,
      b.cardName ?? existing.card_name,
      b.cardNetwork ?? existing.card_network,
      b.cardType ?? existing.card_type,
      b.lastFourDigits ?? existing.last_four_digits,
      newLimit,
      newAvailable,
      newOutstanding,
      newMinDue,
      b.interestRate !== undefined ? Number(b.interestRate) : existing.interest_rate,
      b.annualFee !== undefined ? Number(b.annualFee) : existing.annual_fee,
      b.joiningFee !== undefined ? Number(b.joiningFee) : existing.joining_fee,
      b.billingCycle ?? existing.billing_cycle,
      b.statementGenerationDate ?? existing.statement_generation_date,
      b.paymentDueDate ?? existing.payment_due_date,
      b.cardStatus ?? existing.card_status,
      b.cardColorTheme ?? existing.card_color_theme,
      existing.id,
      uid,
    ]
  );

  await writeAuditLog(db, uid, 'CARD_UPDATED', 'credit_cards', existing.id, req);
  const updated = await db.queryOne(`SELECT * FROM credit_cards WHERE id = $1`, [existing.id]);
  res.json({ card: updated });
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const existing = await db.queryOne(`SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    uid,
  ]);
  if (!existing) {
    res.status(404).json({ error: 'Credit card not found.' });
    return;
  }
  await db.execute(`DELETE FROM credit_cards WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
  await writeAuditLog(db, uid, 'CARD_DELETED', 'credit_cards', String(req.params.id), req);
  res.json({ message: 'Credit card removed successfully.' });
});

export default router;
