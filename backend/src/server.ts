import express from 'express';
import cors from 'cors';
import { env, validateProductionEnv } from './config/env.js';
import { getDb } from './db/index.js';
import { applyBankCalculationDefaults, runMigrations } from './db/migrations.js';
import { ensureBaseReferenceData, ensureDemoUser } from './db/seed.js';
import {
  securityHeaders,
  csrfProtection,
  sanitizeBody,
  rejectForbiddenCardSecrets,
} from './middleware/security.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startReminderScheduler } from './jobs/reminderJob.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import cardsRoutes from './routes/cards.js';
import billsRoutes from './routes/bills.js';
import transactionsRoutes from './routes/transactions.js';
import offersRoutes from './routes/offers.js';
import rewardsRoutes from './routes/rewards.js';
import analyticsRoutes from './routes/analytics.js';
import notificationsRoutes from './routes/notifications.js';
import calendarRoutes from './routes/calendar.js';
import adminRoutes from './routes/admin.js';

export async function createApp(customSqlitePath?: string) {
  validateProductionEnv();

  const db = getDb(customSqlitePath);
  await runMigrations(db);
  await ensureBaseReferenceData(db);
  await applyBankCalculationDefaults(db);
  await ensureDemoUser(db);

  const app = express();
  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(securityHeaders);
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(sanitizeBody);
  app.use(rejectForbiddenCardSecrets);
  app.use(csrfProtection);

  const authLimiter = createRateLimiter(120, 15 * 60 * 1000);
  const apiLimiter = createRateLimiter(env.rateLimitMaxRequests, env.rateLimitWindowMs);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CardWise API',
      dbMode: db.mode,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/dashboard', apiLimiter, dashboardRoutes);
  app.use('/api/cards', apiLimiter, cardsRoutes);
  app.use('/api/bills', apiLimiter, billsRoutes);
  app.use('/api/transactions', apiLimiter, transactionsRoutes);
  app.use('/api/offers', apiLimiter, offersRoutes);
  app.use('/api/rewards', apiLimiter, rewardsRoutes);
  app.use('/api/analytics', apiLimiter, analyticsRoutes);
  app.use('/api/notifications', apiLimiter, notificationsRoutes);
  app.use('/api/calendar', apiLimiter, calendarRoutes);
  app.use('/api/admin', apiLimiter, adminRoutes);

  app.use(errorHandler);
  return { app, db };
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMain) {
  createApp()
    .then(({ app, db }) => {
      startReminderScheduler(db);
      app.listen(env.port, () => {
        console.log(`CardWise API running on http://localhost:${env.port} (${db.mode} mode)`);
      });
    })
    .catch((err) => {
      console.error('Failed to start CardWise API:', err);
      process.exit(1);
    });
}
