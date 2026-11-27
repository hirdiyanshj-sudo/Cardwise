import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { buildCsv } from '../utils/csv.js';
import { generateExpenseReportPdfBuffer } from '../utils/pdf.js';
import { scoreCardRecommendations, type CatalogCardRow } from '../utils/calculators.js';

const router = Router();
router.use(requireAuth);

router.get('/spending', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const period = String(req.query.period || 'monthly');

  const today = new Date();
  let startDate = '1970-01-01';
  if (period === 'weekly') {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().slice(0, 10);
  } else if (period === 'monthly') {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    startDate = d.toISOString().slice(0, 10);
  } else if (period === 'yearly') {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 1);
    startDate = d.toISOString().slice(0, 10);
  }

  const [txRows, monthlySeries, cardWise, merchantWise, budgets, categories] = await Promise.all([
    db.query<any>(
      `SELECT * FROM transactions
       WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI') AND substr(transaction_date, 1, 10) >= $2
       ORDER BY transaction_date DESC`,
      [uid, startDate]
    ),
    db.query<{ month: string; total: number }>(
      `SELECT substr(transaction_date, 1, 7) AS month, SUM(amount) AS total
       FROM transactions WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI')
       GROUP BY substr(transaction_date, 1, 7) ORDER BY month ASC LIMIT 12`,
      [uid]
    ),
    db.query<any>(
      `SELECT c.id AS card_id, c.card_name, c.bank_name, c.last_four_digits, COALESCE(SUM(t.amount), 0) AS total
       FROM credit_cards c
       LEFT JOIN transactions t ON t.card_id = c.id AND t.transaction_type IN ('Debit', 'EMI') AND substr(t.transaction_date, 1, 10) >= $2
       WHERE c.user_id = $1
       GROUP BY c.id, c.card_name, c.bank_name, c.last_four_digits`,
      [uid, startDate]
    ),
    db.query<any>(
      `SELECT merchant, COUNT(*) AS tx_count, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND transaction_type IN ('Debit', 'EMI') AND substr(transaction_date, 1, 10) >= $2
       GROUP BY merchant ORDER BY total DESC LIMIT 10`,
      [uid, startDate]
    ),
    db.query<any>(`SELECT * FROM budgets WHERE user_id = $1`, [uid]),
    db.query<any>(`SELECT name, color FROM spending_categories`),
  ]);

  const catColorMap = new Map(categories.map((c) => [c.name, c.color]));
  const totalSpent = txRows.reduce((s, t) => s + Number(t.amount), 0);

  const catTotals = new Map<string, number>();
  for (const t of txRows) {
    catTotals.set(t.category_name, (catTotals.get(t.category_name) || 0) + Number(t.amount));
  }
  const categoryBreakdown = Array.from(catTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 1000) / 10 : 0,
      color: catColorMap.get(category) || '#64748B',
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestSpendingCategory = categoryBreakdown[0]?.category || 'None';
  const averageMonthlyExpenditure =
    monthlySeries.length > 0
      ? Math.round(monthlySeries.reduce((s, m) => s + Number(m.total), 0) / monthlySeries.length)
      : totalSpent;

  const currentMonth = today.toISOString().slice(0, 7);
  const currentMonthTx = await db.query<any>(
    `SELECT category_name, SUM(amount) AS total FROM transactions
     WHERE user_id = $1 AND substr(transaction_date, 1, 7) = $2 AND transaction_type IN ('Debit', 'EMI')
     GROUP BY category_name`,
    [uid, currentMonth]
  );
  const monthCatMap = new Map(currentMonthTx.map((r) => [r.category_name, Number(r.total)]));

  const budgetProgress = budgets.map((b) => {
    const spent = monthCatMap.get(b.category_name) || 0;
    const pct = Math.round((spent / Number(b.monthly_limit)) * 1000) / 10;
    return {
      ...b,
      spentThisMonth: spent,
      utilisationPct: pct,
      isOverAlert: pct >= Number(b.alert_threshold_pct),
      isExceeded: pct >= 100,
    };
  });

  res.json({
    period,
    summary: {
      totalSpent,
      transactionCount: txRows.length,
      highestSpendingCategory,
      averageMonthlyExpenditure,
    },
    categoryBreakdown,
    monthlyTrend: monthlySeries.map((m) => ({ month: m.month, spend: Number(m.total) })),
    cardWiseSpend: cardWise.map((c) => ({ ...c, total: Number(c.total) })),
    merchantWiseSpend: merchantWise.map((m) => ({ ...m, total: Number(m.total), tx_count: Number(m.tx_count) })),
    budgets: budgetProgress,
  });
});

router.post('/budgets', async (req, res) => {
  const { categoryName, monthlyLimit, alertThresholdPct = 80 } = req.body || {};
  const limitNum = Number(monthlyLimit);
  if (!categoryName || isNaN(limitNum) || limitNum <= 0) {
    res.status(400).json({ error: 'categoryName and positive monthlyLimit are required.' });
    return;
  }
  const db = getDb();
  const uid = req.user!.id;
  const existing = await db.queryOne<{ id: string }>(
    `SELECT id FROM budgets WHERE user_id = $1 AND category_name = $2`,
    [uid, categoryName]
  );
  if (existing) {
    await db.execute(
      `UPDATE budgets SET monthly_limit = $1, alert_threshold_pct = $2, updated_at = NOW() WHERE id = $3`,
      [limitNum, Number(alertThresholdPct), existing.id]
    );
  } else {
    const cat = await db.queryOne<{ id: string }>(`SELECT id FROM spending_categories WHERE name = $1`, [
      categoryName,
    ]);
    await db.execute(
      `INSERT INTO budgets (id, user_id, category_id, category_name, monthly_limit, alert_threshold_pct)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [crypto.randomUUID(), uid, cat?.id ?? null, categoryName, limitNum, Number(alertThresholdPct)]
    );
  }
  res.json({ message: 'Budget saved.' });
});

router.delete('/budgets/:id', async (req, res) => {
  const db = getDb();
  await db.execute(`DELETE FROM budgets WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  res.json({ message: 'Budget removed.' });
});

router.get('/export/csv', async (req, res) => {
  const db = getDb();
  const rows = await db.query<any>(
    `SELECT t.transaction_date AS Date, c.bank_name AS Bank, c.card_name AS Card,
            c.last_four_digits AS Last4, t.merchant AS Merchant, t.category_name AS Category,
            t.transaction_type AS Type, t.amount AS Amount_INR, t.reward_points_earned AS Points,
            COALESCE(t.description, '') AS Notes
     FROM transactions t
     JOIN credit_cards c ON c.id = t.card_id
     WHERE t.user_id = $1
     ORDER BY t.transaction_date DESC`,
    [req.user!.id]
  );
  const headers = ['Date', 'Bank', 'Card', 'Last4', 'Merchant', 'Category', 'Type', 'Amount_INR', 'Points', 'Notes'];
  const csv = buildCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cardwise-expense-report.csv"');
  res.send(csv);
});

router.get('/export/pdf', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const rows = await db.query<any>(
    `SELECT t.transaction_date, c.card_name, t.merchant, t.category_name, t.amount
     FROM transactions t
     JOIN credit_cards c ON c.id = t.card_id
     WHERE t.user_id = $1 AND t.transaction_type IN ('Debit', 'EMI')
     ORDER BY t.transaction_date DESC`,
    [uid]
  );
  const totalSpent = rows.reduce((s, r) => s + Number(r.amount), 0);
  const catMap = new Map<string, number>();
  for (const r of rows) {
    catMap.set(r.category_name, (catMap.get(r.category_name) || 0) + Number(r.amount));
  }
  const categories = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const buf = await generateExpenseReportPdfBuffer({
    userName: req.user!.fullName,
    periodLabel: 'All Recorded Expenses',
    totalSpent,
    averageMonthly: totalSpent,
    topCategory: categories[0]?.category || 'N/A',
    categories,
    transactions: rows,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="cardwise-expense-report.pdf"');
  res.send(buf);
});

router.post('/compare', async (req, res) => {
  const { cardIds = [], title } = req.body || {};
  if (!Array.isArray(cardIds) || cardIds.length < 2 || cardIds.length > 4) {
    res.status(400).json({ error: 'Select between 2 and 4 cards to compare.' });
    return;
  }
  const db = getDb();
  const catalog = await db.query<CatalogCardRow>(`SELECT * FROM card_catalog`);
  const selected = catalog.filter((c) => cardIds.includes(c.id));

  const scored = selected.map((c) => {
    const score = Math.min(
      98,
      Math.round(
        55 +
          c.cashback_pct * 3 +
          c.reward_rate_pct * 4 +
          (c.annual_fee === 0 ? 10 : 0) +
          (c.forex_markup_pct <= 2 ? 8 : 0)
      )
    );
    return { ...c, comparisonScore: score };
  });

  if (title) {
    await db.execute(
      `INSERT INTO card_comparisons (id, user_id, title, compared_card_ids) VALUES ($1,$2,$3,$4)`,
      [crypto.randomUUID(), req.user!.id, title, JSON.stringify(cardIds)]
    );
  }
  res.json({ comparedCards: scored });
});

router.post('/recommendations', async (req, res) => {
  const {
    monthlyExpenditure = 50000,
    shoppingSharePct = 30,
    travelSharePct = 20,
    diningSharePct = 20,
    fuelSharePct = 10,
    preferredBanks = [],
    preferNoAnnualFee = false,
    preferCashback = false,
  } = req.body || {};

  const db = getDb();
  const catalog = await db.query<CatalogCardRow>(`SELECT * FROM card_catalog`);
  const recommendations = scoreCardRecommendations(catalog, {
    monthlyExpenditure: Number(monthlyExpenditure),
    shoppingSharePct: Number(shoppingSharePct),
    travelSharePct: Number(travelSharePct),
    diningSharePct: Number(diningSharePct),
    fuelSharePct: Number(fuelSharePct),
    preferredBanks: Array.isArray(preferredBanks) ? preferredBanks : [],
    preferNoAnnualFee: Boolean(preferNoAnnualFee),
    preferCashback: Boolean(preferCashback),
  });

  res.json({ recommendations: recommendations.slice(0, 6) });
});

export default router;
