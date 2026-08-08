import { Router } from 'express';
import { db } from '../db.js';
import { ah } from '../async-handler.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const DEFAULTS = { photo_visibility: 0, last_seen_on: 1, paused: 0 };

async function ensureRow(userId) {
  await db.prepare('INSERT IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
}

async function settingsFor(userId) {
  await ensureRow(userId);
  const row = await db.prepare('SELECT photo_visibility, last_seen_on, paused FROM user_settings WHERE user_id = ?').get(userId);
  return row || { ...DEFAULTS };
}

// GET /api/settings
router.get('/settings', authRequired, ah(async (req, res) => {
  res.json({ settings: await settingsFor(req.userId) });
}));

// PATCH /api/settings  { photo_visibility?, last_seen_on?, paused? }
router.patch('/settings', authRequired, ah(async (req, res) => {
  const body = req.body || {};
  const current = await settingsFor(req.userId);
  const next = { ...current };

  if (body.photo_visibility !== undefined) {
    const v = Number(body.photo_visibility);
    if (!Number.isInteger(v) || v < 0 || v > 2) {
      return apiError(res, 422, 'INVALID_PHOTO_VISIBILITY', 'رؤية الصور: ٠ مطابقات محتملة / ١ موثّقون / ٢ كل المسجلين', 'photo_visibility');
    }
    next.photo_visibility = v;
  }
  if (body.last_seen_on !== undefined) {
    if (typeof body.last_seen_on !== 'boolean') return apiError(res, 422, 'INVALID_LAST_SEEN', 'قيمة منطقية مطلوبة', 'last_seen_on');
    next.last_seen_on = body.last_seen_on ? 1 : 0;
  }
  if (body.paused !== undefined) {
    if (typeof body.paused !== 'boolean') return apiError(res, 422, 'INVALID_PAUSED', 'قيمة منطقية مطلوبة', 'paused');
    next.paused = body.paused ? 1 : 0;
  }

  await db.prepare(
    `INSERT INTO user_settings (user_id, photo_visibility, last_seen_on, paused) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       photo_visibility = VALUES(photo_visibility),
       last_seen_on = VALUES(last_seen_on),
       paused = VALUES(paused)`
  ).run(req.userId, next.photo_visibility, next.last_seen_on, next.paused);

  res.json({ settings: next });
}));

export default router;
