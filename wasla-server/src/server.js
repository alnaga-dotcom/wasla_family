import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { config, isProduction, validateConfig } from './config.js';
import { apiError } from './validate.js';
import { applySecurityMiddleware } from './security.js';
import { logger } from './logger.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import discoveryRoutes from './routes/discovery.js';
import matchesRoutes from './routes/matches.js';
import messagesRoutes from './routes/messages.js';
import searchRoutes from './routes/search.js';
import settingsRoutes from './routes/settings.js';
import notificationsRoutes from './routes/notifications.js';
import pushRoutes from './routes/push.js';
import favoritesRoutes from './routes/favorites.js';
import usersRoutes from './routes/users.js';
import trustRoutes from './routes/trust.js';
import accountRoutes from './routes/account.js';
import subscriptionRoutes from './routes/subscriptions.js';
import verificationRoutes from './routes/verification.js';
import photoRoutes from './routes/photos.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import { db } from './db.js';
import { purgeExpired } from './account.js';
import { initPush } from './push.js';
import { initRealtime } from './realtime.js';

validateConfig();
initPush().catch(() => {});

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);

app.use(morgan(isProduction() ? 'combined' : 'dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

applySecurityMiddleware(app);

// CORS: open in development, restricted in production (Wasla_22)
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (isProduction()) {
    const configured = config.corsOrigins.length ? config.corsOrigins : [config.publicDomain].filter(Boolean);
    // Capacitor WebView (native Android/iOS) sends a localhost origin; non-browser
    // callers (native app via plugins, payment webhooks, health checks) send none.
    const allowed = [
      ...configured,
      ...(configured.includes('*')
        ? []
        : ['capacitor://localhost', 'http://localhost', 'http://127.0.0.1', 'https://localhost', 'https://127.0.0.1']),
    ];
    if (origin && !allowed.includes(origin) && !allowed.includes('*')) {
      return apiError(res, 403, 'CORS_REJECTED', 'Origin not allowed');
    }
    res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  let dbOk = false;
  try {
    db.prepare('SELECT 1').get();
    dbOk = true;
  } catch (e) {
    logger.error('health db check failed', e);
  }
  res.json({
    ok: dbOk,
    service: 'wasla-server',
    version: '1.0.0',
    env: config.nodeEnv,
    domain: config.publicDomain,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api', messagesRoutes);
app.use('/api', searchRoutes);
app.use('/api', settingsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api', favoritesRoutes);
app.use('/api', usersRoutes);
app.use('/api', trustRoutes);
app.use('/api', accountRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', verificationRoutes);
app.use('/api', photoRoutes);
app.use('/api/public', publicRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => apiError(res, 404, 'NOT_FOUND', 'المسار غير موجود'));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return apiError(res, 400, 'BAD_JSON', 'جسم الطلب غير صالح');
  }
  if (err.type === 'entity.too.large' || err.statusCode === 413 || err.status === 413) {
    return apiError(res, 413, 'PAYLOAD_TOO_LARGE', 'حجم الطلب كبير جدًا');
  }
  if (err.type === 'request.aborted' || err.type === 'request.timeout') {
    return apiError(res, 408, 'REQUEST_TIMEOUT', 'انتهت مهلة الطلب');
  }
  logger.error('internal error', err);
  return apiError(res, 500, 'INTERNAL', 'خطأ داخلي');
});

const server = app.listen(config.port, () => {
  const purged = purgeExpired();
  logger.info(`Wasla server listening on http://127.0.0.1:${config.port}`);
  if (purged > 0) logger.info(`تطهير الحسابات المنتهية: ${purged}`);
  if (config.devOtpEcho) {
    logger.warn('devOtpEcho ON — رمز OTP يظهر في الاستجابة للتجربة المحلية فقط');
  }
});

initRealtime(server);

function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close((err) => {
    if (err) logger.error('error during shutdown', err);
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
