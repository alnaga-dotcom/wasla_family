import { Router } from 'express';
import { db } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { sendPush } from '../push.js';

const router = Router();

// POST /api/push/token  { token }
router.post('/token', authRequired, (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.length < 20) {
    return apiError(res, 422, 'INVALID_TOKEN', 'رمز الجهاز غير صالح', 'token');
  }
  db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(token, req.userId);
  res.json({ ok: true });
});

// POST /api/push/test  → sends a test push to the current user
router.post('/test', authRequired, async (req, res) => {
  const user = db.prepare('SELECT push_token, name FROM users WHERE id = ?').get(req.userId);
  if (!user?.push_token) {
    return apiError(res, 400, 'NO_PUSH_TOKEN', 'لا يوجد رمز جهاز مسجل', 'token');
  }
  const result = await sendPush({
    token: user.push_token,
    title: 'وصلــه',
    body: 'هذا إشعار تجريبي من وصلــه',
    data: { type: 'test', userId: String(req.userId) },
  });
  res.json(result);
});

export default router;
