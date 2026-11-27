import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { calculateUtilisationPct } from '../utils/calculators.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;

  const range = String(req.query.range || '90d');
  const now = new Date();
  let fromDate = req.query.fromDate ? String(req.query.fromDate) : '';
  const toDate = req.query.toDate ? String(req.query.toDate) : now.toISOString().slice(0, 10);

  if (!fromDate) {
    const start = new Date(now);
    if (range === '7d') start.setDate(start.getDate() - 7);
    else if (range === '30d') start.setDate(start.getDate() - 30);
    else if (range === '90d') start.setDate(start.getDate() - 90);
    else if (range === '1y') start.setFullYear(start.getFullYear() - 1);
    else start.setFullYear(2000);
    fromDate = start.toISOString().slice(0, 10);
  }

  const [
    cards,
    upcomingStatements,
    recentTransactions,
    recentPayments,
    recentNotifs,
    activeOffers,
    reminders,
    monthlyTx,
    categorySpend,
  ] = await Promise.all([
    db.query<any>(`SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC`, [uid]),
    db.query<any>(
      `SELECT s.*, c.bank_name, c.card_name, c.last_four_digits, c.card_network
       FROM statements s
       JOIN credit_cards c ON c.id = s.card_id
       WHERE s.user_id = $1 AND s.payment_status != 'Paid'
       ORDER BY s.payment_due_date ASC LIMIT 8`,
      [uid]
    ),
    db.query<any>(
      `SELECT t.*, c.card_name, c.bank_name, c.last_four_digits
       FROM transactions t
       JOIN credit_cards c ON c.id = t.card_id
       WHERE t.user_id = $1 AND substr(t.transaction_date, 1, 10) >= $2 AND substr(t.transaction_date, 1, 10) <= $3
       ORDER BY t.transaction_date DESC LIMIT 10`,
      [uid, fromDate, toDate]
    ),
    db.query<any>(
      `SELECT p.id, p.amount, p.payment_date AS event_date, p.payment_method, c.bank_name, c.card_name, c.last_four_digits
       FROM payments p
       JOIN credit_cards c ON c.id = p.card_id
       WHERE p.user_id = $1 ORDER BY p.payment_date DESC LIMIT 5`,
      [uid]
    ),
    db.query<any>(
      `SELECT id, type, title, severity, created_at AS event_date FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [uid]
    ),
    db.query<any>(
      `SELECT * FROM bank_offers WHERE is_active = 1 AND (user_id IS NULL OR user_id = $1)
       ORDER BY expiry_date ASC LIMIT 6`,
      [uid]
    ),
    db.query<any>(
      `SELECT r.*, c.card_name, c.bank_name, c.last_four_digits
       FROM payment_reminders r
       JOIN credit_cards c ON c.id = r.card_id
       WHERE r.user_id = $1 AND r.status != 'Dismissed'
       ORDER BY r.due_date ASC LIMIT 6`,
      [uid]
    ),
    db.query<any>(
      `SELECT substr(transaction_date, 1, 7) AS month, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI')
         AND substr(transaction_date, 1, 10) >= $2 AND substr(transaction_date, 1, 10) <= $3
       GROUP BY substr(transaction_date, 1, 7)
       ORDER BY month ASC LIMIT 12`,
      [uid, fromDate, toDate]
    ),
    db.query<any>(
      `SELECT category_name AS name, SUM(amount) AS value
       FROM transactions
       WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI')
         AND substr(transaction_date, 1, 10) >= $2 AND substr(transaction_date, 1, 10) <= $3
       GROUP BY category_name
       ORDER BY value DESC`,
      [uid, fromDate, toDate]
    ),
  ]);

  const totalCards = cards.length;
  const totalCreditLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0);
  const totalAvailableCredit = cards.reduce((sum, c) => sum + Number(c.available_credit_limit || 0), 0);
  const totalUtilisedCredit = cards.reduce((sum, c) => sum + Number(c.used_credit_limit || 0), 0);
  const totalOutstanding = cards.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0);
  const totalMinDue = cards.reduce((sum, c) => sum + Number(c.minimum_amount_due || 0), 0);
  const totalRewardPoints = cards.reduce((sum, c) => sum + Number(c.reward_points_balance || 0), 0);
  const overallUtilisationPct = calculateUtilisationPct(totalUtilisedCredit, totalCreditLimit);

  const rangeSpendRow = await db.queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = $1 AND substr(transaction_date, 1, 10) >= $2 AND substr(transaction_date, 1, 10) <= $3
     AND transaction_type IN ('Debit', 'EMI')`,
    [uid, fromDate, toDate]
  );

  const currentMonth = now.toISOString().slice(0, 7);
  const thisMonthSpendRow = await db.queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = $1 AND substr(transaction_date, 1, 7) = $2 AND transaction_type IN ('Debit', 'EMI')`,
    [uid, currentMonth]
  );

  const cardUtilisation = cards.map((c) => ({
    id: c.id,
    cardName: c.card_name,
    bankName: c.bank_name,
    lastFourDigits: c.last_four_digits,
    limit: Number(c.credit_limit),
    used: Number(c.used_credit_limit),
    available: Number(c.available_credit_limit),
    utilisationPct: calculateUtilisationPct(Number(c.used_credit_limit), Number(c.credit_limit)),
  }));

  // Chronological activity timeline combining transactions, payments, and alerts
  const recentActivity = [
    ...recentTransactions.slice(0, 5).map((t) => ({
      id: `tx-${t.id}`,
      kind: 'transaction',
      title: `${t.merchant}`,
      subtitle: `${t.bank_name} •••• ${t.last_four_digits} • ${t.category_name}`,
      amount: Number(t.amount),
      date: t.transaction_date,
    })),
    ...recentPayments.map((p) => ({
      id: `pay-${p.id}`,
      kind: 'payment',
      title: `Payment (${p.payment_method})`,
      subtitle: `${p.bank_name} • ${p.card_name} •••• ${p.last_four_digits}`,
      amount: Number(p.amount),
      date: p.event_date,
    })),
    ...recentNotifs.map((n) => ({
      id: `notif-${n.id}`,
      kind: 'alert',
      title: n.title,
      subtitle: n.type.replace(/_/g, ' '),
      severity: n.severity,
      date: n.event_date,
    })),
  ]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 10);

  res.json({
    dateRange: { range, fromDate, toDate },
    summary: {
      totalCards,
      totalCreditLimit,
      totalAvailableCredit,
      totalUtilisedCredit,
      totalOutstanding,
      totalMinDue,
      totalRewardPoints,
      monthlyExpenditure: Number(thisMonthSpendRow?.total || 0),
      rangeExpenditure: Number(rangeSpendRow?.total || 0),
      overallUtilisationPct,
      hasDemoData: cards.some((c) => Boolean(c.is_demo)),
    },
    upcomingDeadlines: upcomingStatements,
    recentTransactions,
    recentActivity,
    activeOffers,
    paymentReminders: reminders,
    charts: {
      monthlyTrend: monthlyTx.map((m) => ({ month: m.month, spend: Number(m.total) })),
      categoryBreakdown: categorySpend.map((c) => ({ name: c.name, value: Number(c.value) })),
      cardUtilisation,
    },
  });
});

export default router;
