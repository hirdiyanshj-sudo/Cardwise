import crypto from 'node:crypto';
import type { DbClient } from '../db/index.js';
import { sendEmail } from '../utils/email.js';

export function getTodayDateInTimezone(timeZone = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function runReminderCheckForUser(db: DbClient, userId: string): Promise<number> {
  const user = await db.queryOne<{ email: string; full_name: string }>(
    `SELECT email, full_name FROM users WHERE id = $1`,
    [userId]
  );
  const prefs = await db.queryOne<any>(`SELECT * FROM user_preferences WHERE user_id = $1`, [userId]);
  if (!user || !prefs) return 0;

  const tz = prefs.timezone || 'Asia/Kolkata';
  const todayStr = getTodayDateInTimezone(tz);
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();

  const statements = await db.query<any>(
    `SELECT s.*, c.card_name, c.bank_name, c.last_four_digits
     FROM statements s
     JOIN credit_cards c ON c.id = s.card_id
     WHERE s.user_id = $1 AND s.payment_status != 'Paid' AND (s.total_amount_due - s.amount_paid) > 0`,
    [userId]
  );

  let createdCount = 0;

  for (const st of statements) {
    const dueStr = String(st.payment_due_date).slice(0, 10);
    const dueMs = new Date(`${dueStr}T00:00:00Z`).getTime();
    const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
    const remainingDue = Math.max(0, Number(st.total_amount_due) - Number(st.amount_paid));

    let stage: string | null = null;
    let enabled = false;
    if (diffDays <= 7 && diffDays > 3 && prefs.remind_7_days) {
      stage = '7_days_before';
      enabled = true;
    } else if (diffDays <= 3 && diffDays > 1 && prefs.remind_3_days) {
      stage = '3_days_before';
      enabled = true;
    } else if (diffDays === 1 && prefs.remind_1_day) {
      stage = '1_day_before';
      enabled = true;
    } else if (diffDays === 0 && prefs.remind_due_date) {
      stage = 'due_date';
      enabled = true;
    } else if (diffDays < 0 && prefs.remind_overdue) {
      stage = 'overdue';
      enabled = true;
      if (st.payment_status !== 'Overdue') {
        await db.execute(
          `UPDATE statements SET payment_status = 'Overdue', updated_at = NOW() WHERE id = $1`,
          [st.id]
        );
      }
    }

    if (!stage || !enabled) continue;

    const existingReminder = await db.queryOne<any>(
      `SELECT * FROM payment_reminders WHERE user_id = $1 AND statement_id = $2 AND reminder_stage = $3`,
      [userId, st.id, stage]
    );

    const stageLabel =
      stage === 'overdue'
        ? 'OVERDUE'
        : stage === 'due_date'
          ? 'DUE TODAY'
          : `Due in ${diffDays} day(s)`;

    // Handle safe retry if previous email delivery failed and retry_count < 3
    if (existingReminder) {
      if (
        existingReminder.delivery_status === 'Retry-Scheduled' &&
        Number(existingReminder.retry_count || 0) < 3 &&
        (!existingReminder.next_retry_at || new Date(existingReminder.next_retry_at) <= new Date()) &&
        prefs.notify_email
      ) {
        const retryEmail = await sendEmail(
          user.email,
          `CardWise Reminder (${stageLabel}): ${st.card_name}`,
          `<p>Hi ${user.full_name},</p><p>Your bill of <strong>₹${remainingDue.toLocaleString('en-IN')}</strong> for ${st.bank_name} ${st.card_name} (•••• ${st.last_four_digits}) is ${stageLabel.toLowerCase()} (${dueStr}).</p>`
        );
        const nextRetryCount = Number(existingReminder.retry_count || 0) + 1;
        const status =
          retryEmail.deliveryStatus === 'Delivered'
            ? 'Delivered'
            : nextRetryCount >= 3
              ? 'Failed'
              : 'Retry-Scheduled';
        await db.execute(
          `UPDATE payment_reminders SET
             delivery_status = $1,
             retry_count = $2,
             last_error = $3,
             next_retry_at = $4,
             status = $5,
             sent_at = CASE WHEN $1 = 'Delivered' THEN NOW() ELSE sent_at END
           WHERE id = $6`,
          [
            status,
            nextRetryCount,
            retryEmail.error || null,
            status === 'Retry-Scheduled' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
            status === 'Delivered' ? 'Sent' : 'Scheduled',
            existingReminder.id,
          ]
        );
      }
      continue;
    }

    let inAppDelivered = false;
    if (prefs.notify_in_app) {
      await db.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          crypto.randomUUID(),
          userId,
          stage === 'overdue' ? 'overdue_payment' : 'upcoming_bill',
          `${stageLabel}: ${st.bank_name} ${st.card_name} (•••• ${st.last_four_digits})`,
          `Remaining balance ₹${remainingDue.toLocaleString('en-IN')} due on ${dueStr} (${tz}). Record payment manually once paid via your bank.`,
          stage === 'overdue' ? 'danger' : 'warning',
          st.id,
        ]
      );
      inAppDelivered = true;
    }

    let deliveryStatus = inAppDelivered ? 'InApp-Delivered' : 'Scheduled';
    let lastError: string | null = null;
    let retryCount = 0;
    let nextRetryAt: string | null = null;
    let reminderStatus: 'Scheduled' | 'Sent' = inAppDelivered ? 'Sent' : 'Scheduled';

    if (prefs.notify_email) {
      const emailResult = await sendEmail(
        user.email,
        `CardWise Reminder (${stageLabel}): ${st.card_name}`,
        `<p>Hi ${user.full_name},</p><p>Your bill of <strong>₹${remainingDue.toLocaleString('en-IN')}</strong> for ${st.bank_name} ${st.card_name} (•••• ${st.last_four_digits}) is ${stageLabel.toLowerCase()} (${dueStr}).</p><p>Note: CardWise tracks bills and reminders; pay via your authorised banking app and record the payment manually.</p>`
      );
      if (emailResult.deliveryStatus === 'Delivered') {
        deliveryStatus = 'Delivered';
        reminderStatus = 'Sent';
      } else if (emailResult.deliveryStatus === 'Failed') {
        deliveryStatus = 'Retry-Scheduled';
        retryCount = 1;
        lastError = emailResult.error || 'Email delivery failed';
        nextRetryAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      } else {
        // SMTP not configured - be transparent!
        deliveryStatus = inAppDelivered ? 'InApp-Only (SMTP Unconfigured)' : 'SMTP-Unconfigured';
        lastError = emailResult.error || null;
      }
    }

    await db.execute(
      `INSERT INTO payment_reminders (
        id, user_id, card_id, statement_id, reminder_stage, due_date, amount_due,
        channel_in_app, channel_email, channel_browser, channel_sms, status,
        delivery_status, retry_count, last_error, next_retry_at, timezone, sent_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        crypto.randomUUID(),
        userId,
        st.card_id,
        st.id,
        stage,
        dueStr,
        remainingDue,
        prefs.notify_in_app ? 1 : 0,
        prefs.notify_email ? 1 : 0,
        prefs.notify_browser ? 1 : 0,
        prefs.notify_sms ? 1 : 0,
        reminderStatus,
        deliveryStatus,
        retryCount,
        lastError,
        nextRetryAt,
        tz,
        reminderStatus === 'Sent' ? new Date().toISOString() : null,
      ]
    );
    createdCount++;
  }

  // Expiring offer alerts (within 3 days, avoiding duplicates)
  const soonDate = new Date(todayMs + 3 * 86400000).toISOString().slice(0, 10);
  const expiringOffers = await db.query<any>(
    `SELECT o.id, o.bank_name, o.title, o.expiry_date
     FROM bank_offers o
     JOIN offer_bookmarks b ON b.offer_id = o.id AND b.user_id = $1
     WHERE o.is_active = 1 AND o.expiry_date >= $2 AND o.expiry_date <= $3`,
    [userId, todayStr, soonDate]
  );

  for (const offer of expiringOffers) {
    const exists = await db.queryOne(
      `SELECT id FROM notifications WHERE user_id = $1 AND type = 'expiring_offer' AND related_entity_id = $2`,
      [userId, offer.id]
    );
    if (!exists && prefs.notify_in_app) {
      await db.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, severity, related_entity_id)
         VALUES ($1,$2,'expiring_offer',$3,$4,'info',$5)`,
        [
          crypto.randomUUID(),
          userId,
          `Bookmarked Offer Expiring Soon: ${offer.bank_name}`,
          `${offer.title} expires on ${offer.expiry_date}.`,
          offer.id,
        ]
      );
    }
  }

  return createdCount;
}

export function startReminderScheduler(db: DbClient): NodeJS.Timeout {
  const runAll = async () => {
    try {
      const users = await db.query<{ id: string }>(`SELECT id FROM users WHERE is_active = 1`);
      for (const u of users) {
        await runReminderCheckForUser(db, u.id);
      }
    } catch (err) {
      console.error('[ReminderScheduler]', err);
    }
  };
  setTimeout(runAll, 3000);
  return setInterval(runAll, 60 * 60 * 1000);
}
