import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { ensureDemoUser, seedDemoPortfolioForUser } from '../db/seed.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/security.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/overview', async (_req, res) => {
  const db = getDb();
  const [usersCount, cardsCount, statementsCount, offersCount, verifiedOffersCount, auditLogs] =
    await Promise.all([
      db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM users`),
      db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM credit_cards`),
      db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM statements`),
      db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM bank_offers`),
      db.queryOne<{ c: number }>(
        `SELECT COUNT(*) AS c FROM bank_offers WHERE verification_status = 'verified'`
      ),
      db.query(
        `SELECT id, user_id, action, resource_type, resource_id, ip_address, details, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT 50`
      ),
    ]);

  res.json({
    stats: {
      totalUsers: Number(usersCount?.c || 0),
      totalCardsTracked: Number(cardsCount?.c || 0),
      totalStatements: Number(statementsCount?.c || 0),
      totalOffers: Number(offersCount?.c || 0),
      verifiedOffers: Number(verifiedOffersCount?.c || 0),
    },
    recentAuditLogs: auditLogs,
  });
});

// Manage Banks & Bank-Specific Calculation Rules
router.get('/banks', async (_req, res) => {
  const db = getDb();
  const banks = await db.query(`SELECT * FROM banks ORDER BY name ASC`);
  res.json({ banks });
});

router.put('/banks/:id', async (req, res) => {
  const db = getDb();
  const bankId = String(req.params.id);
  const { defaultApr, gstRatePct, minDuePct, minDueFloor, lateFeeSlabs, supportUrl, isActive } =
    req.body || {};

  const existing = await db.queryOne(`SELECT * FROM banks WHERE id = $1`, [bankId]);
  if (!existing) {
    res.status(404).json({ error: 'Bank not found.' });
    return;
  }

  await db.execute(
    `UPDATE banks SET
       default_apr = COALESCE($1, default_apr),
       gst_rate_pct = COALESCE($2, gst_rate_pct),
       min_due_pct = COALESCE($3, min_due_pct),
       min_due_floor = COALESCE($4, min_due_floor),
       late_fee_slabs_json = COALESCE($5, late_fee_slabs_json),
       support_url = COALESCE($6, support_url),
       is_active = COALESCE($7, is_active)
     WHERE id = $8`,
    [
      defaultApr !== undefined ? Number(defaultApr) : null,
      gstRatePct !== undefined ? Number(gstRatePct) : null,
      minDuePct !== undefined ? Number(minDuePct) : null,
      minDueFloor !== undefined ? Number(minDueFloor) : null,
      lateFeeSlabs !== undefined ? JSON.stringify(lateFeeSlabs) : null,
      supportUrl ?? null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      bankId,
    ]
  );

  await writeAuditLog(db, req.user!.id, 'ADMIN_BANK_UPDATED', 'banks', bankId, req);
  const updated = await db.queryOne(`SELECT * FROM banks WHERE id = $1`, [bankId]);
  res.json({ bank: updated });
});

// Manage Card Catalog
router.get('/catalog', async (_req, res) => {
  const db = getDb();
  const catalog = await db.query(`SELECT * FROM card_catalog ORDER BY bank_name ASC, card_name ASC`);
  res.json({ catalog });
});

router.post('/catalog', async (req, res) => {
  const b = req.body || {};
  if (!b.bankName || !b.cardName || !b.cardNetwork || !b.cardType) {
    res.status(400).json({ error: 'bankName, cardName, cardNetwork, and cardType are required.' });
    return;
  }
  const db = getDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO card_catalog (
      id, bank_name, card_name, card_network, card_type, annual_fee, joining_fee,
      interest_rate, cashback_pct, reward_rate_pct, lounge_access, dining_benefits,
      shopping_benefits, travel_benefits, fuel_benefits, movie_benefits,
      forex_markup_pct, milestone_benefits, eligibility_criteria, best_for_categories, color_theme
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [
      id,
      b.bankName,
      b.cardName,
      b.cardNetwork,
      b.cardType,
      Number(b.annualFee || 0),
      Number(b.joiningFee || 0),
      Number(b.interestRate || 42),
      Number(b.cashbackPct || 0),
      Number(b.rewardRatePct || 1.5),
      b.loungeAccess || 'Standard domestic lounge terms',
      b.diningBenefits || 'Partner dining offers',
      b.shoppingBenefits || 'Online shopping rewards',
      b.travelBenefits || 'Standard travel coverage',
      b.fuelBenefits || '1% fuel surcharge waiver',
      b.movieBenefits || 'Standard movie offers',
      Number(b.forexMarkupPct ?? 3.5),
      b.milestoneBenefits || 'None',
      b.eligibilityCriteria || 'As per bank underwriting policy',
      b.bestForCategories || 'Shopping,Dining',
      b.colorTheme || 'navy-gold',
    ]
  );
  await writeAuditLog(db, req.user!.id, 'ADMIN_CATALOG_CREATED', 'card_catalog', id, req);
  const item = await db.queryOne(`SELECT * FROM card_catalog WHERE id = $1`, [id]);
  res.status(201).json({ card: item });
});

router.delete('/catalog/:id', async (req, res) => {
  const db = getDb();
  const id = String(req.params.id);
  await db.execute(`DELETE FROM card_catalog WHERE id = $1`, [id]);
  await writeAuditLog(db, req.user!.id, 'ADMIN_CATALOG_DELETED', 'card_catalog', id, req);
  res.json({ message: 'Catalog card deleted.' });
});

// Create, Verify & Expire Global Bank Offers
router.get('/offers', async (_req, res) => {
  const db = getDb();
  const offers = await db.query(
    `SELECT * FROM bank_offers WHERE user_id IS NULL ORDER BY expiry_date ASC`
  );
  res.json({ offers });
});

router.post('/offers', async (req, res) => {
  const b = req.body || {};
  if (!b.bankName || !b.title || !b.category || !b.merchant || !b.expiryDate) {
    res.status(400).json({ error: 'bankName, title, category, merchant, and expiryDate are required.' });
    return;
  }
  const db = getDb();
  const bankRow = await db.queryOne<{ id: string }>(`SELECT id FROM banks WHERE name = $1`, [b.bankName]);
  const id = crypto.randomUUID();
  const status = b.verificationStatus === 'verified' ? 'verified' : 'unverified';
  const source = status === 'verified' ? 'verified' : 'manual';

  await db.execute(
    `INSERT INTO bank_offers (
      id, user_id, bank_id, bank_name, title, applicable_cards, category, subcategory,
      merchant, discount_percentage, max_discount, min_transaction_amount,
      offer_validity, expiry_date, terms_and_conditions, offer_source, promo_code,
      is_active, source_url, verification_status, last_verified_at, verified_by
    ) VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,$18,$19,$20)`,
    [
      id,
      bankRow?.id ?? null,
      b.bankName,
      b.title,
      b.applicableCards || `${b.bankName} Credit Cards`,
      b.category,
      b.subcategory || '',
      b.merchant,
      Number(b.discountPercentage || 0),
      Number(b.maxDiscount || 0),
      Number(b.minTransactionAmount || 0),
      b.offerValidity || 'Verified offer period',
      b.expiryDate,
      b.termsAndConditions || 'Verify terms on official bank portal.',
      source,
      b.promoCode || '',
      b.sourceUrl || '',
      status,
      status === 'verified' ? new Date().toISOString() : null,
      status === 'verified' ? req.user!.id : null,
    ]
  );

  await writeAuditLog(db, req.user!.id, 'ADMIN_OFFER_CREATED', 'bank_offers', id, req);
  const created = await db.queryOne(`SELECT * FROM bank_offers WHERE id = $1`, [id]);
  res.status(201).json({ offer: created });
});

router.put('/offers/:id/verify', async (req, res) => {
  const db = getDb();
  const offerId = String(req.params.id);
  const { verificationStatus, sourceUrl, expiryDate, isActive } = req.body || {};

  const existing = await db.queryOne(`SELECT * FROM bank_offers WHERE id = $1`, [offerId]);
  if (!existing) {
    res.status(404).json({ error: 'Offer not found.' });
    return;
  }

  const nextStatus = verificationStatus || 'verified';
  const nextSource = nextStatus === 'verified' ? 'verified' : nextStatus === 'demo' ? 'demo' : 'manual';

  await db.execute(
    `UPDATE bank_offers SET
       verification_status = $1,
       offer_source = $2,
       source_url = COALESCE($3, source_url),
       expiry_date = COALESCE($4, expiry_date),
       is_active = COALESCE($5, is_active),
       last_verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE last_verified_at END,
       verified_by = CASE WHEN $1 = 'verified' THEN $6 ELSE verified_by END
     WHERE id = $7`,
    [
      nextStatus,
      nextSource,
      sourceUrl ?? null,
      expiryDate ?? null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      req.user!.id,
      offerId,
    ]
  );

  await writeAuditLog(db, req.user!.id, 'ADMIN_OFFER_VERIFIED', 'bank_offers', offerId, req, {
    verificationStatus: nextStatus,
  });
  const updated = await db.queryOne(`SELECT * FROM bank_offers WHERE id = $1`, [offerId]);
  res.json({ offer: updated });
});

router.delete('/offers/:id', async (req, res) => {
  const db = getDb();
  const id = String(req.params.id);
  await db.execute(`DELETE FROM bank_offers WHERE id = $1`, [id]);
  await writeAuditLog(db, req.user!.id, 'ADMIN_OFFER_DELETED', 'bank_offers', id, req);
  res.json({ message: 'Offer deleted.' });
});

router.post('/demo/reset', async (req, res) => {
  const db = getDb();
  const demoId = await ensureDemoUser(db);
  await db.execute(`DELETE FROM credit_cards WHERE user_id = $1`, [demoId]);
  await db.execute(`DELETE FROM budgets WHERE user_id = $1`, [demoId]);
  await db.execute(`DELETE FROM notifications WHERE user_id = $1`, [demoId]);
  await seedDemoPortfolioForUser(db, demoId);
  await writeAuditLog(db, req.user!.id, 'ADMIN_DEMO_RESET', 'users', demoId, req);
  res.json({ message: 'Demo user portfolio reset cleanly.' });
});

router.get('/audit-logs', async (req, res) => {
  const db = getDb();
  const action = req.query.action ? String(req.query.action) : null;
  const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  let sql = `SELECT * FROM audit_logs`;
  const params: unknown[] = [];
  if (action) {
    params.push(`%${action}%`);
    sql += ` WHERE action LIKE $${params.length}`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const logs = await db.query(sql, params);
  res.json({ logs });
});

export default router;
