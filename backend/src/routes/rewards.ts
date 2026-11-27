import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

async function computeCardRewardLedger(db: ReturnType<typeof getDb>, uid: string, cardId: string) {
  const rows = await db.query<any>(
    `SELECT action_type, points, COALESCE(cashback_inr, 0) AS cashback_inr
     FROM reward_transactions WHERE user_id = $1 AND card_id = $2`,
    [uid, cardId]
  );

  let earned = 0;
  let redeemed = 0;
  let expired = 0;
  let adjusted = 0;
  let cashbackInr = 0;

  for (const r of rows) {
    const pts = Number(r.points || 0);
    cashbackInr += Number(r.cashback_inr || 0);
    if (r.action_type === 'Earned') earned += pts;
    else if (r.action_type === 'Redeemed') redeemed += pts;
    else if (r.action_type === 'Expired') expired += pts;
    else if (r.action_type === 'Adjusted') adjusted += pts;
  }

  const currentBalance = Math.max(0, earned + adjusted - redeemed - expired);
  return {
    earned,
    redeemed,
    expired,
    currentBalance,
    cashbackInr: Math.round(cashbackInr * 100) / 100,
    hasLedgerRows: rows.length > 0,
  };
}

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;

  const [cards, summaries, history] = await Promise.all([
    db.query<any>(`SELECT * FROM credit_cards WHERE user_id = $1`, [uid]),
    db.query<any>(`SELECT * FROM reward_points WHERE user_id = $1`, [uid]),
    db.query<any>(
      `SELECT rt.*, c.bank_name, c.card_name, c.last_four_digits
       FROM reward_transactions rt
       JOIN credit_cards c ON c.id = rt.card_id
       WHERE rt.user_id = $1
       ORDER BY rt.transaction_date DESC LIMIT 80`,
      [uid]
    ),
  ]);

  const cardBalances = await Promise.all(
    cards.map(async (c) => {
      const s = summaries.find((r) => r.card_id === c.id);
      const ledger = await computeCardRewardLedger(db, uid, c.id);

      const currentBalance = ledger.hasLedgerRows
        ? ledger.currentBalance
        : s
          ? Number(s.current_balance)
          : Number(c.reward_points_balance);
      const totalEarned = ledger.hasLedgerRows ? ledger.earned : s ? Number(s.total_earned) : currentBalance;
      const totalRedeemed = ledger.hasLedgerRows ? ledger.redeemed : s ? Number(s.total_redeemed) : 0;
      const totalExpired = ledger.hasLedgerRows ? ledger.expired : s ? Number(s.total_expired) : 0;
      const totalCashbackInr = ledger.hasLedgerRows ? ledger.cashbackInr : Number(s?.total_cashback_inr || 0);
      const rate = s ? Number(s.conversion_rate_inr) : Number(c.reward_point_value_inr || 0.25);

      return {
        cardId: c.id,
        bankName: c.bank_name,
        cardName: c.card_name,
        lastFourDigits: c.last_four_digits,
        currentBalance,
        totalEarned,
        totalRedeemed,
        totalExpired,
        totalCashbackInr,
        conversionRateInr: rate,
        estimatedInrValue: Math.round(currentBalance * rate * 100) / 100,
        expiringSoonPoints: s ? Number(s.expiring_soon_points) : 0,
        nextExpiryDate: s?.next_expiry_date || null,
      };
    })
  );

  const totals = cardBalances.reduce(
    (acc, item) => {
      acc.totalPoints += item.currentBalance;
      acc.totalEarned += item.totalEarned;
      acc.totalRedeemed += item.totalRedeemed;
      acc.totalExpired += item.totalExpired;
      acc.totalInrValue += item.estimatedInrValue;
      acc.totalCashbackInr += item.totalCashbackInr;
      acc.expiringSoon += item.expiringSoonPoints;
      return acc;
    },
    {
      totalPoints: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      totalExpired: 0,
      totalInrValue: 0,
      totalCashbackInr: 0,
      expiringSoon: 0,
    }
  );

  res.json({ totals, cardBalances, history });
});

router.post('/transactions', async (req, res) => {
  const { cardId, actionType, points = 0, cashbackInr = 0, description, redemptionPartner, expiryDate } =
    req.body || {};
  const pts = Math.max(0, Math.round(Number(points || 0)));
  const cb = Math.max(0, Number(cashbackInr || 0));

  if (!cardId || !actionType || (pts <= 0 && cb <= 0) || !description) {
    res.status(400).json({
      error: 'cardId, actionType, description, and positive points or cashbackInr are required.',
    });
    return;
  }
  if (!['Earned', 'Redeemed', 'Expired', 'Adjusted'].includes(actionType)) {
    res.status(400).json({ error: 'Invalid reward actionType.' });
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

  const ledgerBefore = await computeCardRewardLedger(db, uid, cardId);
  const currentPts = ledgerBefore.hasLedgerRows
    ? ledgerBefore.currentBalance
    : Number(card.reward_points_balance);

  if ((actionType === 'Redeemed' || actionType === 'Expired') && pts > currentPts) {
    res.status(400).json({ error: 'Insufficient reward points balance on this card.' });
    return;
  }

  const summary = await db.queryOne<any>(
    `SELECT * FROM reward_points WHERE card_id = $1 AND user_id = $2`,
    [cardId, uid]
  );
  const rate = Number(summary?.conversion_rate_inr || card.reward_point_value_inr || 0.25);
  const inrValue = Math.round((pts * rate + cb) * 100) / 100;
  const txId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO reward_transactions (
        id, user_id, card_id, action_type, points, inr_value, cashback_inr, description, redemption_partner, expiry_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        txId,
        uid,
        cardId,
        actionType,
        pts,
        inrValue,
        cb,
        description,
        redemptionPartner || null,
        expiryDate || null,
      ]
    );

    const ledgerAfter = await computeCardRewardLedger(tx, uid, cardId);
    const newBal = ledgerAfter.currentBalance;

    if (summary) {
      await tx.execute(
        `UPDATE reward_points SET
          total_earned = $1,
          total_redeemed = $2,
          total_expired = $3,
          current_balance = $4,
          total_cashback_inr = $5,
          updated_at = NOW()
         WHERE id = $6`,
        [
          ledgerAfter.earned,
          ledgerAfter.redeemed,
          ledgerAfter.expired,
          newBal,
          ledgerAfter.cashbackInr,
          summary.id,
        ]
      );
    } else {
      await tx.execute(
        `INSERT INTO reward_points (
          id, user_id, card_id, total_earned, total_redeemed, total_expired, current_balance, conversion_rate_inr, total_cashback_inr
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          crypto.randomUUID(),
          uid,
          cardId,
          ledgerAfter.earned,
          ledgerAfter.redeemed,
          ledgerAfter.expired,
          newBal,
          rate,
          ledgerAfter.cashbackInr,
        ]
      );
    }

    await tx.execute(
      `UPDATE credit_cards SET reward_points_balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBal, cardId]
    );
  });

  res.status(201).json({ message: 'Reward & cashback transaction recorded from ledger.' });
});

export default router;
