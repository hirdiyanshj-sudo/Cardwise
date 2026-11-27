import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;

  const [cards, statements, offers, rewards, reminders] = await Promise.all([
    db.query<any>(`SELECT * FROM credit_cards WHERE user_id = $1`, [uid]),
    db.query<any>(
      `SELECT s.*, c.bank_name, c.card_name, c.last_four_digits
       FROM statements s JOIN credit_cards c ON c.id = s.card_id WHERE s.user_id = $1`,
      [uid]
    ),
    db.query<any>(
      `SELECT * FROM bank_offers WHERE is_active = 1 AND (user_id IS NULL OR user_id = $1)`,
      [uid]
    ),
    db.query<any>(
      `SELECT rp.*, c.bank_name, c.card_name, c.last_four_digits
       FROM reward_points rp JOIN credit_cards c ON c.id = rp.card_id
       WHERE rp.user_id = $1 AND rp.next_expiry_date IS NOT NULL AND rp.expiring_soon_points > 0`,
      [uid]
    ),
    db.query<any>(
      `SELECT r.*, c.bank_name, c.card_name, c.last_four_digits
       FROM payment_reminders r JOIN credit_cards c ON c.id = r.card_id
       WHERE r.user_id = $1`,
      [uid]
    ),
  ]);

  const events: Array<{
    id: string;
    date: string;
    type: 'statement' | 'due_date' | 'offer_expiry' | 'reward_expiry' | 'reminder';
    title: string;
    subtitle: string;
    amount?: number;
    status?: string;
  }> = [];

  for (const c of cards) {
    if (c.statement_generation_date) {
      events.push({
        id: `stmt-card-${c.id}`,
        date: c.statement_generation_date,
        type: 'statement',
        title: `Statement: ${c.card_name}`,
        subtitle: `${c.bank_name} •••• ${c.last_four_digits}`,
      });
    }
    if (c.payment_due_date) {
      events.push({
        id: `due-card-${c.id}`,
        date: c.payment_due_date,
        type: 'due_date',
        title: `Due: ${c.card_name}`,
        subtitle: `Outstanding ₹${Number(c.outstanding_balance).toLocaleString('en-IN')}`,
        amount: Number(c.outstanding_balance),
      });
    }
  }

  for (const s of statements) {
    if (s.payment_status !== 'Paid') {
      events.push({
        id: `stmt-due-${s.id}`,
        date: s.payment_due_date,
        type: 'due_date',
        title: `Bill Due (${s.payment_status}): ${s.card_name}`,
        subtitle: `${s.bank_name} •••• ${s.last_four_digits}`,
        amount: Math.max(0, Number(s.total_amount_due) - Number(s.amount_paid)),
        status: s.payment_status,
      });
    }
  }

  for (const o of offers) {
    events.push({
      id: `offer-${o.id}`,
      date: o.expiry_date,
      type: 'offer_expiry',
      title: `Offer Ends: ${o.merchant}`,
      subtitle: `${o.bank_name} - ${o.title}`,
    });
  }

  for (const r of rewards) {
    events.push({
      id: `rew-${r.id}`,
      date: r.next_expiry_date,
      type: 'reward_expiry',
      title: `Points Expire: ${r.card_name}`,
      subtitle: `${Number(r.expiring_soon_points).toLocaleString('en-IN')} pts expiring`,
    });
  }

  for (const rem of reminders) {
    events.push({
      id: `rem-${rem.id}`,
      date: rem.due_date,
      type: 'reminder',
      title: `Reminder (${rem.reminder_stage.replace(/_/g, ' ')}): ${rem.card_name}`,
      subtitle: `Due ₹${Number(rem.amount_due).toLocaleString('en-IN')}`,
    });
  }

  // Deduplicate by id
  const unique = Array.from(new Map(events.map((e) => [e.id, e])).values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  res.json({ events: unique });
});

export default router;
