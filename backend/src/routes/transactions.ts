import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/security.js';
import { autoCategorizeMerchant, calculateUtilisationPct } from '../utils/calculators.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const { cardId, category, search, fromDate, toDate, page = '1', limit = '50', sortBy = 'transaction_date', sortOrder = 'desc' } =
    req.query;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(5, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const allowedSort: Record<string, string> = {
    transaction_date: 't.transaction_date',
    amount: 't.amount',
    merchant: 't.merchant',
    category_name: 't.category_name',
  };
  const orderCol = allowedSort[String(sortBy)] || 't.transaction_date';
  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  let where = ` WHERE t.user_id = $1`;
  const params: unknown[] = [uid];

  if (cardId && cardId !== 'all') {
    params.push(String(cardId));
    where += ` AND t.card_id = $${params.length}`;
  }
  if (category && category !== 'all') {
    params.push(String(category));
    where += ` AND t.category_name = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(t.merchant) LIKE $${params.length} OR LOWER(COALESCE(t.description, '')) LIKE $${params.length})`;
  }
  if (fromDate) {
    params.push(String(fromDate));
    where += ` AND substr(t.transaction_date, 1, 10) >= $${params.length}`;
  }
  if (toDate) {
    params.push(String(toDate));
    where += ` AND substr(t.transaction_date, 1, 10) <= $${params.length}`;
  }

  const countRow = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM transactions t ${where}`,
    params
  );

  const dataParams = [...params, limitNum, offset];
  const transactions = await db.query(
    `SELECT t.*, c.bank_name, c.card_name, c.last_four_digits
     FROM transactions t
     JOIN credit_cards c ON c.id = t.card_id
     ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  res.json({
    transactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount: Number(countRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limitNum)),
    },
  });
});

router.post('/', async (req, res) => {
  const {
    cardId,
    merchant,
    description = '',
    amount,
    categoryName,
    transactionType = 'Debit',
    transactionDate,
  } = req.body || {};

  const txAmount = Number(amount);
  if (!cardId || !merchant || isNaN(txAmount) || txAmount <= 0) {
    res.status(400).json({ error: 'cardId, merchant, and positive amount are required.' });
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

  const resolvedCategory = categoryName || autoCategorizeMerchant(String(merchant), String(description));
  const catRow = await db.queryOne<{ id: string }>(
    `SELECT id FROM spending_categories WHERE name = $1`,
    [resolvedCategory]
  );

  const avgTx = await db.queryOne<{ avg_amt: number }>(
    `SELECT AVG(amount) AS avg_amt FROM transactions WHERE user_id = $1 AND transaction_type = 'Debit'`,
    [uid]
  );
  const avgVal = Number(avgTx?.avg_amt || 0);
  const isUnusual = transactionType === 'Debit' && ((avgVal > 0 && txAmount > avgVal * 3) || txAmount >= 50000);
  const pointsEarned = transactionType === 'Debit' ? Math.max(0, Math.round((txAmount / 100) * 2)) : 0;
  const txId = crypto.randomUUID();
  const txDateIso = transactionDate ? new Date(String(transactionDate)).toISOString() : new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO transactions (
        id, user_id, card_id, category_id, category_name, merchant, description,
        amount, transaction_type, transaction_date, reward_points_earned, is_flagged_unusual
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        txId,
        uid,
        cardId,
        catRow?.id ?? null,
        resolvedCategory,
        String(merchant),
        String(description),
        txAmount,
        transactionType,
        txDateIso,
        pointsEarned,
        isUnusual ? 1 : 0,
      ]
    );

    const delta = transactionType === 'Refund' || transactionType === 'Credit' ? -txAmount : txAmount;
    const newUsed = Math.max(0, Number(card.used_credit_limit) + delta);
    const newOutstanding = Math.max(0, Number(card.outstanding_balance) + delta);
    const newAvailable = Math.max(0, Number(card.credit_limit) - newUsed);
    const newMinDue = Math.round(newOutstanding * 0.05 * 100) / 100;
    const newPoints = Math.max(0, Number(card.reward_points_balance) + pointsEarned);

    await tx.execute(
      `UPDATE credit_cards SET
        used_credit_limit = $1,
        outstanding_balance = $2,
        available_credit_limit = $3,
        minimum_amount_due = $4,
        reward_points_balance = $5,
        updated_at = NOW()
       WHERE id = $6`,
      [newUsed, newOutstanding, newAvailable, newMinDue, newPoints, cardId]
    );

    if (pointsEarned > 0) {
      await tx.execute(
        `UPDATE reward_points SET total_earned = total_earned + $1, current_balance = current_balance + $1, updated_at = NOW()
         WHERE card_id = $2 AND user_id = $3`,
        [pointsEarned, cardId, uid]
      );
      await tx.execute(
        `INSERT INTO reward_transactions (id, user_id, card_id, action_type, points, inr_value, description)
         VALUES ($1,$2,$3,'Earned',$4,$5,$6)`,
        [
          crypto.randomUUID(),
          uid,
          cardId,
          pointsEarned,
          Math.round(pointsEarned * Number(card.reward_point_value_inr) * 100) / 100,
          `Earned on ${merchant} spend`,
        ]
      );
    }

    if (isUnusual) {
      await tx.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
         VALUES ($1,$2,'unusual_spending',$3,$4,'warning',$5)`,
        [
          crypto.randomUUID(),
          uid,
          `Unusual Spend Alert: ₹${txAmount.toLocaleString('en-IN')} at ${merchant}`,
          `Transaction on ${card.card_name} (•••• ${card.last_four_digits}) is higher than your typical average spend.`,
          txId,
        ]
      );
    }

    const utilPct = calculateUtilisationPct(newUsed, Number(card.credit_limit));
    if (utilPct > 30) {
      await tx.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
         VALUES ($1,$2,'high_utilisation',$3,$4,'warning',$5)`,
        [
          crypto.randomUUID(),
          uid,
          `Utilisation Warning: ${card.card_name} at ${utilPct}%`,
          `Credit utilisation crossed 30% after your ₹${txAmount.toLocaleString('en-IN')} transaction at ${merchant}.`,
          cardId,
        ]
      );
    }
  });

  const budget = await db.queryOne<any>(
    `SELECT * FROM budgets WHERE user_id = $1 AND category_name = $2`,
    [uid, resolvedCategory]
  );
  if (budget) {
    const monthStr = txDateIso.slice(0, 7);
    const spent = await db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE user_id = $1 AND category_name = $2 AND substr(transaction_date, 1, 7) = $3 AND transaction_type IN ('Debit', 'EMI')`,
      [uid, resolvedCategory, monthStr]
    );
    const spentAmt = Number(spent?.total || 0);
    const pct = (spentAmt / Number(budget.monthly_limit)) * 100;
    if (pct >= Number(budget.alert_threshold_pct)) {
      await db.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
         VALUES ($1,$2,'budget_alert',$3,$4,$5,$6)`,
        [
          crypto.randomUUID(),
          uid,
          `Budget Alert: ${resolvedCategory} (${Math.round(pct)}% used)`,
          `You have spent ₹${spentAmt.toLocaleString('en-IN')} of your ₹${Number(budget.monthly_limit).toLocaleString('en-IN')} monthly ${resolvedCategory} budget.`,
          pct >= 100 ? 'danger' : 'warning',
          budget.id,
        ]
      );
    }
  }

  await writeAuditLog(db, uid, 'TRANSACTION_CREATED', 'transactions', txId, req, {
    merchant,
    amount: txAmount,
  });

  const created = await db.queryOne(
    `SELECT t.*, c.bank_name, c.card_name, c.last_four_digits FROM transactions t JOIN credit_cards c ON c.id = t.card_id WHERE t.id = $1`,
    [txId]
  );
  res.status(201).json({ transaction: created });
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const txRow = await db.queryOne<any>(
    `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
    [req.params.id, uid]
  );
  if (!txRow) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(`DELETE FROM transactions WHERE id = $1 AND user_id = $2`, [txRow.id, uid]);
    if (txRow.transaction_type === 'Debit' || txRow.transaction_type === 'EMI') {
      const card = await tx.queryOne<any>(`SELECT * FROM credit_cards WHERE id = $1`, [txRow.card_id]);
      if (card) {
        const newUsed = Math.max(0, Number(card.used_credit_limit) - Number(txRow.amount));
        const newOutstanding = Math.max(0, Number(card.outstanding_balance) - Number(txRow.amount));
        const newAvailable = Math.min(Number(card.credit_limit), Number(card.credit_limit) - newUsed);
        await tx.execute(
          `UPDATE credit_cards SET used_credit_limit = $1, outstanding_balance = $2, available_credit_limit = $3, updated_at = NOW() WHERE id = $4`,
          [newUsed, newOutstanding, newAvailable, card.id]
        );
      }
    }
  });

  await writeAuditLog(db, uid, 'TRANSACTION_DELETED', 'transactions', String(req.params.id), req);
  res.json({ message: 'Transaction deleted and card balance adjusted.' });
});

export default router;
