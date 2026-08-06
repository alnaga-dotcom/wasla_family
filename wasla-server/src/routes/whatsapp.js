import { Router } from 'express';
import { logger } from '../logger.js';

const router = Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'wasla_verify_2026';

// GET /api/whatsapp/webhook — Meta subscription verification handshake.
// Meta calls this with hub.mode / hub.verify_token / hub.challenge when the
// callback URL is saved in the WhatsApp API Setup → Webhook settings.
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified by Meta');
    return res.status(200).type('text/plain').send(String(challenge));
  }
  logger.warn('WhatsApp webhook verification rejected', { mode, token });
  return res.status(403).send('Verification failed');
});

// POST /api/whatsapp/webhook — message + delivery-status callbacks from Meta.
// Acknowledge immediately (Meta retries on non-2xx); the current usage only
// needs OTP send confirmation, so entries are logged for observability.
router.post('/webhook', (req, res) => {
  const { entry } = req.body || {};
  if (!Array.isArray(entry)) return res.sendStatus(200);
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      if (value.statuses) {
        for (const s of value.statuses) {
          logger.info('WhatsApp message status', { id: s.id, status: s.status, recipientId: s.recipient_id });
        }
      }
      if (value.messages) {
        for (const m of value.messages) {
          logger.info('WhatsApp inbound message', { from: m.from, type: m.type, id: m.id });
        }
      }
    }
  }
  return res.sendStatus(200);
});

export default router;
