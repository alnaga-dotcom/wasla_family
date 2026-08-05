import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired, emailVerifiedRequired } from '../middleware/auth.js';
import { publicCard } from '../cards.js';
import { getRecommendations, markOpened } from '../recommendations.js';

const router = Router();

// GET /api/discovery/recommendations?limit=
router.get('/recommendations', authRequired, emailVerifiedRequired, (req, res) => {
  const me = req.userId;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const ranked = getRecommendations(me, limit);

  const recommendations = ranked.map((r) => {
    const card = publicCard(r.userId);
    if (!card) return null;
    return { ...card, score: r.score, matchScore: r.matchScore, matchLevel: r.matchLevel, matchReasons: r.reasons, recommendationReasons: r.reasons };
  }).filter(Boolean);

  res.json({ recommendations });
});

// POST /api/discovery/recommendations/seen  { userId }
router.post('/recommendations/seen', authRequired, (req, res) => {
  const { userId } = req.body || {};
  const target = Number(userId);
  if (!Number.isInteger(target) || target === req.userId) {
    return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح', 'userId');
  }
  db.prepare('INSERT OR IGNORE INTO discovery_views (actor_id, target_id, created_at) VALUES (?, ?, ?)')
    .run(req.userId, target, nowIso());
  markOpened(req.userId, target);
  res.json({ ok: true });
});

export default router;
