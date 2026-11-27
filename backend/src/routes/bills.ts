import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/security.js';
import {
  calculateLatePaymentFee,
  calculateRevolvingInterest,
} from '../utils/calculators.js';
import { generateStatementPdfBuffer } from '../utils/pdf.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const statusFilter = req.query.status ? String(req.query.status) : null;
  const limit = Math.min(100, Math.max(5, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  let stmtSql = `
    SELECT s.*, c.bank_name, c.card_name, c.last_four_digits, c.card_network, c.credit_limit, c.interest_rate
    FROM statements s
    JOIN credit_cards c ON c.id = s.card_id
    WHERE s.user_id = $1
  `;
  const stmtParams: unknown[] = [uid];
  if (statusFilter && statusFilter !== 'all') {
    stmtParams.push(statusFilter);
    stmtSql += ` AND s.payment_status = $${stmtParams.length}`;
  }
  stmtParams.push(limit, offset);
  stmtSql += ` ORDER BY s.payment_due_date DESC LIMIT $${stmtParams.length - 1} OFFSET $${stmtParams.length}`;

  const [statements, payments, cards] = await Promise.all([
    db.query<any>(stmtSql, stmtParams),
    db.query<any>(
      `SELECT p.*, c.bank_name, c.card_name, c.last_four_digits
       FROM payments p
       JOIN credit_cards c ON c.id = p.card_id
       WHERE p.user_id = $1
       ORDER BY p.payment_date DESC LIMIT 50`,
      [uid]
    ),
    db.query<any>(`SELECT * FROM credit_cards WHERE user_id = $1`, [uid]),
  ]);

  const unbilledEstimates = await Promise.all(
    cards.map(async (c) => {
      const txSum = await db.queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
         WHERE card_id = $1 AND user_id = $2 AND transaction_type IN ('Debit', 'EMI')
         AND substr(transaction_date, 1, 7) = $3`,
        [c.id, uid, new Date().toISOString().slice(0, 7)]
      );
      return {
        cardId: c.id,
        bankName: c.bank_name,
        cardName: c.card_name,
        lastFourDigits: c.last_four_digits,
        currentOutstanding: Number(c.outstanding_balance),
        thisMonthTransactions: Number(txSum?.total || 0),
        estimatedNextBill: Math.max(Number(c.outstanding_balance), Number(txSum?.total || 0)),
        nextStatementDate: c.statement_generation_date,
        nextDueDate: c.payment_due_date,
      };
    })
  );

  res.json({ statements, payments, unbilledEstimates });
});

router.post('/generate', async (req, res) => {
  const { cardId, statementMonth } = req.body || {};
  if (!cardId) {
    res.status(400).json({ error: 'cardId is required to generate a statement.' });
    return;
  }
  const db = getDb();
  const uid = req.user!.id;
  const card = await db.queryOne<any>(
    `SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`,
    [cardId, uid]
  );
  if (!card) {
    res.status(404).json({ error: 'Credit card not found.' });
    return;
  }

  const bank = await db.queryOne<{ min_due_pct: number; min_due_floor: number }>(
    `SELECT min_due_pct, min_due_floor FROM banks WHERE name = $1`,
    [card.bank_name]
  );

  const targetMonth = statementMonth || new Date().toISOString().slice(0, 7);
  const existing = await db.queryOne<any>(
    `SELECT id FROM statements WHERE card_id = $1 AND user_id = $2 AND statement_month = $3`,
    [cardId, uid, targetMonth]
  );
  if (existing) {
    res.status(409).json({ error: `A statement for ${targetMonth} already exists for this card.` });
    return;
  }

  const [debitsRow, creditsRow] = await Promise.all([
    db.queryOne<{ total: number; pts: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(reward_points_earned), 0) AS pts
       FROM transactions
       WHERE card_id = $1 AND user_id = $2 AND substr(transaction_date, 1, 7) = $3 AND transaction_type IN ('Debit', 'EMI')`,
      [cardId, uid, targetMonth]
    ),
    db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE card_id = $1 AND user_id = $2 AND substr(transaction_date, 1, 7) = $3 AND transaction_type IN ('Credit', 'Refund')`,
      [cardId, uid, targetMonth]
    ),
  ]);

  const newCharges = Number(debitsRow?.total || 0);
  const credits = Number(creditsRow?.total || 0);
  const totalDue = Math.max(0, newCharges - credits);
  const minDuePct = Number(bank?.min_due_pct || 5) / 100;
  const minDueFloor = Number(bank?.min_due_floor || 100);
  const minDue =
    totalDue === 0 ? 0 : Math.min(totalDue, Math.max(minDueFloor, Math.round(totalDue * minDuePct * 100) / 100));

  const stmtGenDate = `${targetMonth}-${String(card.statement_generation_day || 15).padStart(2, '0')}`;
  const dueObj = new Date(stmtGenDate);
  dueObj.setDate(dueObj.getDate() + 20);
  const dueDate = dueObj.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const paymentStatus = totalDue === 0 ? 'Paid' : dueDate < todayStr ? 'Overdue' : 'Pending';

  const stmtId = crypto.randomUUID();
  const cycleId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO card_billing_cycles (
        id, user_id, card_id, cycle_start_date, cycle_end_date,
        statement_generation_date, payment_due_date, opening_balance,
        total_spends, total_payments, closing_balance, minimum_due, status
      ) VALUES ($1,$2,$3,$4,$5,$5,$6,0,$7,$8,$9,$10,'Billed')`,
      [cycleId, uid, cardId, `${targetMonth}-01`, stmtGenDate, dueDate, newCharges, credits, totalDue, minDue]
    );

    await tx.execute(
      `INSERT INTO statements (
        id, user_id, card_id, billing_cycle_id, statement_month, billing_period,
        statement_generation_date, payment_due_date, previous_balance, new_charges,
        payments_credits, interest_charges, total_amount_due, minimum_amount_due,
        amount_paid, payment_status, reward_points_earned
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,0,$11,$12,0,$13,$14)`,
      [
        stmtId,
        uid,
        cardId,
        cycleId,
        targetMonth,
        card.billing_cycle,
        stmtGenDate,
        dueDate,
        newCharges,
        credits,
        totalDue,
        minDue,
        paymentStatus,
        Number(debitsRow?.pts || 0),
      ]
    );
  });

  await writeAuditLog(db, uid, 'STATEMENT_GENERATED', 'statements', stmtId, req, { targetMonth, totalDue });
  const created = await db.queryOne(
    `SELECT s.*, c.bank_name, c.card_name, c.last_four_digits FROM statements s JOIN credit_cards c ON c.id = s.card_id WHERE s.id = $1`,
    [stmtId]
  );
  res.status(201).json({ statement: created });
});

router.post('/statements', async (req, res) => {
  const {
    cardId,
    statementMonth,
    billingPeriod,
    statementGenerationDate,
    paymentDueDate,
    totalAmountDue,
    minimumAmountDue,
  } = req.body || {};
  if (!cardId || totalAmountDue === undefined || !paymentDueDate) {
    res.status(400).json({ error: 'cardId, totalAmountDue, and paymentDueDate are required.' });
    return;
  }
  const db = getDb();
  const uid = req.user!.id;
  const card = await db.queryOne<any>(`SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`, [
    cardId,
    uid,
  ]);
  if (!card) {
    res.status(404).json({ error: 'Card not found.' });
    return;
  }
  const totalDue = Number(totalAmountDue);
  const minDue =
    minimumAmountDue !== undefined ? Number(minimumAmountDue) : Math.round(totalDue * 0.05 * 100) / 100;
  const id = crypto.randomUUID();
  const todayStr = new Date().toISOString().slice(0, 10);
  const status = totalDue === 0 ? 'Paid' : paymentDueDate < todayStr ? 'Overdue' : 'Pending';

  await db.execute(
    `INSERT INTO statements (
      id, user_id, card_id, statement_month, billing_period,
      statement_generation_date, payment_due_date, new_charges, total_amount_due,
      minimum_amount_due, amount_paid, payment_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,0,$10)`,
    [
      id,
      uid,
      cardId,
      statementMonth || todayStr.slice(0, 7),
      billingPeriod || card.billing_cycle,
      statementGenerationDate || todayStr,
      paymentDueDate,
      totalDue,
      minDue,
      status,
    ]
  );

  await writeAuditLog(db, uid, 'STATEMENT_CREATED', 'statements', id, req);
  const stmt = await db.queryOne(`SELECT * FROM statements WHERE id = $1`, [id]);
  res.status(201).json({ statement: stmt });
});

router.post('/payments', async (req, res) => {
  const { cardId, statementId, amount, paymentMethod = 'UPI', referenceNumber, notes } = req.body || {};
  const payAmount = Number(amount);
  if (!cardId || isNaN(payAmount) || payAmount <= 0) {
    res.status(400).json({ error: 'Valid cardId and positive payment amount are required.' });
    return;
  }

  const db = getDb();
  const uid = req.user!.id;
  const card = await db.queryOne<any>(`SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`, [
    cardId,
    uid,
  ]);
  if (!card) {
    res.status(404).json({ error: 'Credit card not found.' });
    return;
  }

  const paymentId = crypto.randomUUID();
  let paymentType: 'Full' | 'Minimum' | 'Partial' | 'Manual Record' = 'Manual Record';

  await db.transaction(async (tx) => {
    let targetStmtId = statementId || null;
    if (!targetStmtId) {
      const openStmt = await tx.queryOne<any>(
        `SELECT * FROM statements WHERE card_id = $1 AND user_id = $2 AND payment_status != 'Paid'
         ORDER BY payment_due_date ASC LIMIT 1`,
        [cardId, uid]
      );
      if (openStmt) targetStmtId = openStmt.id;
    }

    if (targetStmtId) {
      const stmt = await tx.queryOne<any>(
        `SELECT * FROM statements WHERE id = $1 AND user_id = $2`,
        [targetStmtId, uid]
      );
      if (stmt) {
        const newPaid = Number(stmt.amount_paid) + payAmount;
        const totalDue = Number(stmt.total_amount_due);
        const minDue = Number(stmt.minimum_amount_due);
        let newStatus = stmt.payment_status;
        if (newPaid >= totalDue - 0.01) {
          newStatus = 'Paid';
          paymentType = 'Full';
        } else if (newPaid > 0) {
          newStatus = 'Partially Paid';
          paymentType = payAmount <= minDue + 0.01 ? 'Minimum' : 'Partial';
        }
        await tx.execute(
          `UPDATE statements SET amount_paid = $1, payment_status = $2, updated_at = NOW() WHERE id = $3`,
          [newPaid, newStatus, stmt.id]
        );
      }
    }

    await tx.execute(
      `INSERT INTO payments (
        id, user_id, card_id, statement_id, amount, payment_date, payment_method,
        reference_number, payment_type, status, notes
      ) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,'Confirmed',$9)`,
      [
        paymentId,
        uid,
        cardId,
        targetStmtId,
        payAmount,
        paymentMethod,
        referenceNumber || `MAN${Date.now().toString().slice(-8)}`,
        paymentType,
        notes || 'Manual payment recorded by cardholder',
      ]
    );

    const newOutstanding = Math.max(0, Number(card.outstanding_balance) - payAmount);
    const newUsed = Math.max(0, Number(card.used_credit_limit) - payAmount);
    const newAvailable = Math.min(Number(card.credit_limit), Number(card.credit_limit) - newUsed);
    const newMinDue = newOutstanding === 0 ? 0 : Math.min(newOutstanding, Math.round(newOutstanding * 0.05));

    await tx.execute(
      `UPDATE credit_cards SET
        outstanding_balance = $1,
        used_credit_limit = $2,
        available_credit_limit = $3,
        minimum_amount_due = $4,
        updated_at = NOW()
       WHERE id = $5`,
      [newOutstanding, newUsed, newAvailable, newMinDue, cardId]
    );

    await tx.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
       VALUES ($1,$2,'payment_confirmation',$3,$4,'success',$5)`,
      [
        crypto.randomUUID(),
        uid,
        `Payment Recorded: ${card.bank_name} ${card.card_name}`,
        `Manual payment of ₹${payAmount.toLocaleString('en-IN')} via ${paymentMethod} confirmed. New outstanding: ₹${newOutstanding.toLocaleString('en-IN')}.`,
        paymentId,
      ]
    );
  });

  await writeAuditLog(db, uid, 'PAYMENT_RECORDED', 'payments', paymentId, req, {
    cardId,
    amount: payAmount,
  });

  const payment = await db.queryOne(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  res.status(201).json({ payment, message: 'Manual payment recorded and balances updated.' });
});

router.post('/calculators', async (req, res) => {
  const { outstandingAmount = 0, annualInterestRate, daysOverdue = 15, bankName } = req.body || {};
  const db = getDb();

  let bankRow: any = null;
  if (bankName) {
    bankRow = await db.queryOne(
      `SELECT name, late_fee_slabs_json, default_apr, gst_rate_pct FROM banks WHERE name = $1`,
      [String(bankName)]
    );
  }

  let slabs = null;
  if (bankRow?.late_fee_slabs_json) {
    try {
      slabs = JSON.parse(bankRow.late_fee_slabs_json);
    } catch {
      slabs = null;
    }
  }

  const gstRate = Number(bankRow?.gst_rate_pct || 18);
  const apr =
    annualInterestRate !== undefined && annualInterestRate !== ''
      ? Number(annualInterestRate)
      : Number(bankRow?.default_apr || 42);

  const lateFee = calculateLatePaymentFee(Number(outstandingAmount), slabs, gstRate);
  const interest = calculateRevolvingInterest(Number(outstandingAmount), apr, Number(daysOverdue), gstRate);

  res.json({
    bankName: bankRow?.name || 'Generic Indian Bank Estimate',
    appliedApr: apr,
    gstRatePct: gstRate,
    lateFee,
    interest,
    combinedPenaltyAndInterest:
      Math.round((lateFee.totalFee + interest.totalInterestCharge) * 100) / 100,
    disclaimer: lateFee.isEstimate
      ? 'Estimated using standard Indian card slabs because bank-specific schedule was unavailable.'
      : `Calculated using configured ${bankRow.name} estimate schedule (+${gstRate}% GST). Check your card MITC for exact terms.`,
  });
});

router.get('/statements/:id/pdf', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const statement = await db.queryOne<any>(
    `SELECT * FROM statements WHERE id = $1 AND user_id = $2`,
    [req.params.id, uid]
  );
  if (!statement) {
    res.status(404).json({ error: 'Statement not found.' });
    return;
  }
  const card = await db.queryOne<any>(`SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`, [
    statement.card_id,
    uid,
  ]);
  const transactions = await db.query<any>(
    `SELECT transaction_date, merchant, category_name, transaction_type, amount
     FROM transactions WHERE card_id = $1 AND user_id = $2 ORDER BY transaction_date DESC LIMIT 30`,
    [statement.card_id, uid]
  );

  const pdfBuffer = await generateStatementPdfBuffer({
    userName: req.user!.fullName,
    userEmail: req.user!.email,
    card,
    statement,
    transactions,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="cardwise-statement-${statement.statement_month}-${card.last_four_digits}.pdf"`
  );
  res.send(pdfBuffer);
});

export default router;
