import { logger } from './logger.js';

let messaging = null;
let provider = 'console';

export async function initPush() {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const { initializeApp, cert } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      messaging = getMessaging();
      provider = 'fcm';
      logger.info('Firebase push initialized');
    } catch (err) {
      logger.error('Failed to initialize Firebase push', { error: err.message });
    }
  }
}

export async function sendPush({ token, title, body, data = {} }) {
  if (!token) return { ok: false, reason: 'no_token' };
  if (provider === 'console' || !messaging) {
    logger.info('[PUSH console]', { token, title, body, data });
    return { ok: true, channel: 'console' };
  }
  try {
    const result = await messaging.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'wasla' } },
    });
    logger.info('FCM push sent', { token: token.slice(0, 20), messageId: result });
    return { ok: true, channel: 'fcm', messageId: result };
  } catch (err) {
    logger.error('FCM push failed', { error: err.message, token: token.slice(0, 20) });
    return { ok: false, reason: err.message };
  }
}
