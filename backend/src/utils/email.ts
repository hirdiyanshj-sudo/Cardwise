import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailPreview {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  mode: 'smtp' | 'dev-preview';
  deliveryStatus: 'Delivered' | 'Pending-SMTP-Unconfigured' | 'Failed';
  messageId?: string;
  error?: string;
}

const recentPreviews: EmailPreview[] = [];

export function getRecentEmailPreviews(toEmail?: string): EmailPreview[] {
  if (!toEmail) return recentPreviews.slice(0, 20);
  return recentPreviews.filter((e) => e.to.toLowerCase() === toEmail.toLowerCase()).slice(0, 20);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailPreview> {
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: { user: env.smtpUser, pass: env.smtpPass },
      });
      const info = await transporter.sendMail({
        from: env.smtpFrom,
        to,
        subject,
        html,
      });
      const entry: EmailPreview = {
        id: `${Date.now()}`,
        to,
        subject,
        body: html,
        sentAt: new Date().toISOString(),
        mode: 'smtp',
        deliveryStatus: 'Delivered',
        messageId: info.messageId,
      };
      recentPreviews.unshift(entry);
      if (recentPreviews.length > 50) recentPreviews.pop();
      return entry;
    } catch (err: any) {
      const entry: EmailPreview = {
        id: `${Date.now()}`,
        to,
        subject,
        body: html,
        sentAt: new Date().toISOString(),
        mode: 'smtp',
        deliveryStatus: 'Failed',
        error: err?.message || 'SMTP send failed',
      };
      recentPreviews.unshift(entry);
      if (recentPreviews.length > 50) recentPreviews.pop();
      return entry;
    }
  }

  const entry: EmailPreview = {
    id: `${Date.now()}`,
    to,
    subject,
    body: html,
    sentAt: new Date().toISOString(),
    mode: 'dev-preview',
    deliveryStatus: 'Pending-SMTP-Unconfigured',
    error: 'SMTP credentials are not configured; email was not delivered to an external inbox.',
  };
  if (env.nodeEnv !== 'production') {
    recentPreviews.unshift(entry);
    if (recentPreviews.length > 50) recentPreviews.pop();
  }
  return entry;
}
