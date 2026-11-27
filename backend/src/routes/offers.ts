import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const { bank, category, card, minDiscount, expiryBefore, bookmarkedOnly, search, verificationStatus } =
    req.query;

  let sql = `
    SELECT o.*,
      CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS is_bookmarked
    FROM bank_offers o
    LEFT JOIN offer_bookmarks b ON b.offer_id = o.id AND b.user_id = $1
    WHERE o.is_active = 1 AND (o.user_id IS NULL OR o.user_id = $1)
  `;
  const params: unknown[] = [uid];

  if (bank && bank !== 'all') {
    params.push(String(bank));
    sql += ` AND o.bank_name = $${params.length}`;
  }
  if (category && category !== 'all') {
    params.push(String(category));
    sql += ` AND o.category = $${params.length}`;
  }
  if (verificationStatus && verificationStatus !== 'all') {
    params.push(String(verificationStatus));
    sql += ` AND o.verification_status = $${params.length}`;
  }
  if (card && card !== 'all') {
    params.push(`%${String(card).toLowerCase()}%`);
    sql += ` AND LOWER(o.applicable_cards) LIKE $${params.length}`;
  }
  if (minDiscount) {
    params.push(Number(minDiscount));
    sql += ` AND o.discount_percentage >= $${params.length}`;
  }
  if (expiryBefore) {
    params.push(String(expiryBefore));
    sql += ` AND o.expiry_date <= $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    sql += ` AND (LOWER(o.title) LIKE $${params.length} OR LOWER(o.merchant) LIKE $${params.length} OR LOWER(o.applicable_cards) LIKE $${params.length})`;
  }
  if (bookmarkedOnly === 'true') {
    sql += ` AND b.id IS NOT NULL`;
  }

  sql += ` ORDER BY o.expiry_date ASC`;
  const offers = await db.query<any>(sql, params);
  res.json({
    offers: offers.map((o) => ({
      ...o,
      is_bookmarked: Boolean(o.is_bookmarked),
    })),
  });
});

router.post('/', async (req, res) => {
  const {
    bankName,
    title,
    applicableCards,
    category,
    subcategory = '',
    merchant,
    discountPercentage = 0,
    maxDiscount = 0,
    minTransactionAmount = 0,
    offerValidity = 'User-entered validity',
    expiryDate,
    termsAndConditions = 'Manually entered by user',
    promoCode = '',
    sourceUrl = '',
  } = req.body || {};

  if (!bankName || !title || !category || !merchant || !expiryDate) {
    res.status(400).json({ error: 'bankName, title, category, merchant, and expiryDate are required.' });
    return;
  }

  // Ordinary users can submit personal/unverified offers; only admins can mark global offers as 'verified'
  const db = getDb();
  const bankRow = await db.queryOne<{ id: string }>(`SELECT id FROM banks WHERE name = $1`, [bankName]);
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO bank_offers (
      id, user_id, bank_id, bank_name, title, applicable_cards, category, subcategory,
      merchant, discount_percentage, max_discount, min_transaction_amount,
      offer_validity, expiry_date, terms_and_conditions, offer_source, promo_code,
      is_active, source_url, verification_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual',$16,1,$17,'unverified')`,
    [
      id,
      req.user!.id,
      bankRow?.id ?? null,
      bankName,
      title,
      applicableCards || `${bankName} Credit Cards`,
      category,
      subcategory,
      merchant,
      Number(discountPercentage),
      Number(maxDiscount),
      Number(minTransactionAmount),
      offerValidity,
      expiryDate,
      termsAndConditions,
      promoCode,
      sourceUrl,
    ]
  );

  const created = await db.queryOne(`SELECT * FROM bank_offers WHERE id = $1`, [id]);
  res.status(201).json({ offer: { ...created, is_bookmarked: false } });
});

router.post('/:id/bookmark', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const offerId = String(req.params.id);
  const existing = await db.queryOne<{ id: string }>(
    `SELECT id FROM offer_bookmarks WHERE user_id = $1 AND offer_id = $2`,
    [uid, offerId]
  );

  if (existing) {
    await db.execute(`DELETE FROM offer_bookmarks WHERE id = $1`, [existing.id]);
    res.json({ bookmarked: false });
  } else {
    await db.execute(
      `INSERT INTO offer_bookmarks (id, user_id, offer_id) VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), uid, offerId]
    );
    res.json({ bookmarked: true });
  }
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const result = await db.execute(`DELETE FROM bank_offers WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.user!.id,
  ]);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Custom offer not found or cannot delete global offers.' });
    return;
  }
  res.json({ message: 'Offer deleted.' });
});

export default router;
