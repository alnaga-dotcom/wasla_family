import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { ah } from '../async-handler.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { publicCard } from '../cards.js';

const router = Router();

async function activeTargetOrError(res, userId) {
  const u = await db.prepare('SELECT id, status FROM users WHERE id = ?').get(userId);
  if (!u || u.status !== 'active') {
    apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
    return null;
  }
  return u;
}

// GET /api/favorites
router.get('/favorites', authRequired, ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT f.favorite_id AS id FROM favorites f
     WHERE f.user_id = ? AND EXISTS (SELECT 1 FROM users u WHERE u.id = f.favorite_id AND u.status = 'active' AND u.deleted_at IS NULL)
     ORDER BY f.created_at DESC`
  ).all(req.userId);
  const cards = await Promise.all(rows.map((r) => publicCard(r.id)));
  const items = cards.filter(Boolean);
  res.json({ favorites: items });
}));

// POST /api/favorites/{id}
router.post('/favorites/:id', authRequired, ah(async (req, res) => {
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === req.userId) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!await activeTargetOrError(res, other)) return;
  await db.prepare('INSERT IGNORE INTO favorites (user_id, favorite_id, created_at) VALUES (?, ?, ?)')
    .run(req.userId, other, nowIso());
  res.status(201).json({ ok: true, favorite: true });
}));

// DELETE /api/favorites/{id}
router.delete('/favorites/:id', authRequired, ah(async (req, res) => {
  const other = Number(req.params.id);
  if (!Number.isInteger(other)) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  await db.prepare('DELETE FROM favorites WHERE user_id = ? AND favorite_id = ?').run(req.userId, other);
  res.json({ ok: true, favorite: false });
}));

export default router;
