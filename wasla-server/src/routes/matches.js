import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { profileFields, publicCard } from '../cards.js';
import { notify } from '../notify.js';
import { canLike, useLike } from '../subscription.js';
import { getMatchScore } from '../matching.js';
import { publish } from '../events.js';
import { pushToUser } from '../realtime.js';
import { ah } from '../async-handler.js';

const router = Router();

const REASON_MAP = [
  { key: 'city', label: 'نفس المدينة' },
  { key: 'education', label: 'توافق تعليمي' },
  { key: 'religiosity', label: 'توافق ديني' },
  { key: 'lifestyle', label: 'نفس نمط الحياة' },
  { key: 'nationality', label: 'نفس الجنسية' },
];

// GET /api/matches/{id}/reasons — أسباب متبادلة آمنة (Wasla_12: Reason Safety)
router.get('/:id/reasons', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!(await bothLiked(me, other))) return apiError(res, 403, 'NOT_MUTUAL', 'الأسباب تظهر فقط للمطابقة المتبادلة (Wasla_12)');
  const mine = await profileFields(me);
  const theirs = await profileFields(other);
  const reasons = [];
  REASON_MAP.forEach((r) => {
    if (mine[r.key] && theirs[r.key] && mine[r.key] === theirs[r.key]) reasons.push(r.label);
  });
  res.json({ reasons });
}));

async function targetUserOr404(res, userId) {
  const u = await db.prepare('SELECT id, status, deleted_at, is_demo FROM users WHERE id = ?').get(userId);
  if (!u) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  if (u.status !== 'active' || u.deleted_at) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  return u;
}

async function bothLiked(a, b) {
  const rows = await db.prepare(
    `SELECT action FROM match_actions WHERE (actor_id = ? AND target_id = ?) OR (actor_id = ? AND target_id = ?)`
  ).all(a, b, b, a);
  return rows.length === 2 && rows.every((r) => r.action === 'like');
}

// POST /api/matches/{id}/like  { like: true } | { like: false }  (false = pass)
router.post('/:id/like', authRequired, ah(async (req, res) => {
  const target = Number(req.params.id);
  const like = req.body && req.body.like !== false;
  if (!Number.isInteger(target) || target === req.userId) {
    return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  }
  const u = await targetUserOr404(res, target);
  if (!u) return;

  // حسابات العرض التجريبية: لا تبادل إعجابات بين حساب حقيقي وحساب تجريبي (Wasla demo)
  if (like) {
    const me = await db.prepare('SELECT is_demo FROM users WHERE id = ?').get(req.userId);
    if (me && (me.is_demo === 1) !== (u.is_demo === 1)) {
      return apiError(res, 403, 'DEMO_INTERACTION_BLOCKED', 'الحسابات التجريبية للعرض فقط — لا يمكن إرسال إعجاب من أو لحساب تجريبي', 'like');
    }
  }

  // Free-tier daily like quota (Wasla_17)
  const existing = await db.prepare('SELECT action FROM match_actions WHERE actor_id = ? AND target_id = ?').get(req.userId, target);
  if (like && (!existing || existing.action !== 'like') && !(await canLike(req.userId))) {
    return apiError(res, 403, 'LIKE_QUOTA_EXCEEDED', 'لقد تجاوزت الحد اليومي للإعجابات — اشترِك للإعجاب بدون حدود', 'like');
  }

  const action = like ? 'like' : 'pass';
  await db.prepare(
    `INSERT INTO match_actions (actor_id, target_id, action, created_at) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE action = VALUES(action), created_at = VALUES(created_at)`
  ).run(req.userId, target, action, nowIso());

  if (like && (!existing || existing.action !== 'like')) {
    await useLike(req.userId);
  }

  const mutual = like && (await bothLiked(req.userId, target));
  if (like) {
    const myRow = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId);
    const myName = myRow.name;
    await notify(target, 'like', myName + ' أرسل لك إعجابًا', req.userId);
    if (mutual) {
      const theirRow = await db.prepare('SELECT name FROM users WHERE id = ?').get(target);
      const theirName = theirRow.name;
      await notify(req.userId, 'match', 'تطابق متبادل مع ' + theirName + ' — فُتحت المحادثة', target);
      await notify(target, 'match', 'تطابق متبادل مع ' + myName + ' — فُتحت المحادثة', req.userId);
    }
  }
  await publish('LikeSent', { targetId: target, action, mutual }, 'api', { userId: req.userId, entityType: 'match', entityId: `${req.userId}:${target}` });
  pushToUser(target, { event: 'LikeReceived', fromUserId: req.userId, action, mutual });
  if (mutual) {
    await publish('MatchMutual', { userA: req.userId, userB: target }, 'api', { userId: req.userId, entityType: 'match', entityId: `${req.userId}:${target}` });
    pushToUser(req.userId, { event: 'MatchMutual', otherId: target });
    pushToUser(target, { event: 'MatchMutual', otherId: req.userId });
  }
  res.json({ action, mutual });
}));

// GET /api/matches/mutual
router.get('/mutual', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const rows = await db.prepare(
    `SELECT a.target_id AS other_id, a.created_at AS matched_at
     FROM match_actions a
     WHERE a.actor_id = ? AND a.action = 'like'
       AND EXISTS (SELECT 1 FROM match_actions b WHERE b.actor_id = a.target_id AND b.target_id = ? AND b.action = 'like')
       AND NOT EXISTS (SELECT 1 FROM archived_matches ar WHERE ar.user_id = ? AND ar.other_id = a.target_id)`
  ).all(me, me, me);

  const matches = (await Promise.all(rows.map(async (r) => {
    const card = await publicCard(r.other_id);
    if (!card) return null;
    const score = await getMatchScore(me, r.other_id);
    return {
      userId: card.userId,
      name: card.name,
      gender: card.gender,
      trustLevel: card.trustLevel,
      isDemo: card.isDemo,
      matchedAt: r.matched_at,
      matchScore: score.score,
      matchLevel: score.level,
      matchReasons: score.reasons,
    };
  }))).filter(Boolean);

  res.json({ matches });
}));

// GET /api/matches/{id}/score
router.get('/:id/score', authRequired, ah(async (req, res) => {
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === req.userId) {
    return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  }
  const score = await getMatchScore(req.userId, other);
  res.json({ userId: other, ...score });
}));

// POST /api/matches/{id}/archive
router.post('/:id/archive', authRequired, ah(async (req, res) => {
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === req.userId) {
    return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  }
  await db.prepare('INSERT IGNORE INTO archived_matches (user_id, other_id, created_at) VALUES (?, ?, ?)')
    .run(req.userId, other, nowIso());
  res.json({ ok: true });
}));

export default router;
