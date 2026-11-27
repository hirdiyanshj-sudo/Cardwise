import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { runReminderCheckForUser } from '../jobs/reminderJob.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const [notifications, reminders, preferences] = await Promise.all([
    db.query<any>(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [uid]
    ),
    db.query<any>(
      `SELECT r.*, c.bank_name, c.card_name, c.last_four_digits
       FROM payment_reminders r
       JOIN credit_cards c ON c.id = r.card_id
       WHERE r.user_id = $1 ORDER BY r.due_date ASC LIMIT 30`,
      [uid]
    ),
    db.queryOne<any>(`SELECT * FROM user_preferences WHERE user_id = $1`, [uid]),
  ]);

  res.json({
    notifications: notifications.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
    reminders,
    preferences,
  });
});

router.patch('/:id/read', async (req, res) => {
  const db = getDb();
  await db.execute(`UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.user!.id,
  ]);
  res.json({ message: 'Notification marked as read.' });
});

router.post('/read-all', async (req, res) => {
  const db = getDb();
  await db.execute(`UPDATE notifications SET is_read = 1 WHERE user_id = $1`, [req.user!.id]);
  res.json({ message: 'All notifications marked as read.' });
});

router.put('/preferences', async (req, res) => {
  const p = req.body || {};
  const db = getDb();
  await db.execute(
    `UPDATE user_preferences SET
      theme = COALESCE($1, theme),
      timezone = COALESCE($2, timezone),
      notify_in_app = COALESCE($3, notify_in_app),
      notify_email = COALESCE($4, notify_email),
      notify_browser = COALESCE($5, notify_browser),
      notify_sms = COALESCE($6, notify_sms),
      remind_7_days = COALESCE($7, remind_7_days),
      remind_3_days = COALESCE($8, remind_3_days),
      remind_1_day = COALESCE($9, remind_1_day),
      remind_due_date = COALESCE($10, remind_due_date),
      remind_overdue = COALESCE($11, remind_overdue),
      utilisation_alert_threshold = COALESCE($12, utilisation_alert_threshold),
      updated_at = NOW()
     WHERE user_id = $13`,
    [
      p.theme ?? null,
      p.timezone ?? null,
      p.notifyInApp !== undefined ? (p.notifyInApp ? 1 : 0) : null,
      p.notifyEmail !== undefined ? (p.notifyEmail ? 1 : 0) : null,
      p.notifyBrowser !== undefined ? (p.notifyBrowser ? 1 : 0) : null,
      p.notifySms !== undefined ? (p.notifySms ? 1 : 0) : null,
      p.remind7Days !== undefined ? (p.remind7Days ? 1 : 0) : null,
      p.remind3Days !== undefined ? (p.remind3Days ? 1 : 0) : null,
      p.remind1Day !== undefined ? (p.remind1Day ? 1 : 0) : null,
      p.remindDueDate !== undefined ? (p.remindDueDate ? 1 : 0) : null,
      p.remindOverdue !== undefined ? (p.remindOverdue ? 1 : 0) : null,
      p.utilisationAlertThreshold !== undefined ? Number(p.utilisationAlertThreshold) : null,
      req.user!.id,
    ]
  );
  res.json({ message: 'Notification preferences updated.' });
});

router.post('/check-reminders', async (req, res) => {
  const db = getDb();
  const created = await runReminderCheckForUser(db, req.user!.id);
  res.json({ createdReminders: created, message: `Checked due dates; processed ${created} new reminder(s).` });
});

export default router;
