import { Router } from 'express';
import { db } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { publicCard } from '../cards.js';

const router = Router();

// GET /api/users/{id}/profile — ملف آمن بحسب رؤية المشاهد (Wasla_05/21)
router.get('/users/:id/profile', authRequired, (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');

  const u = db.prepare('SELECT id, status, deleted_at FROM users WHERE id = ?').get(other);
  if (!u || u.status !== 'active' || u.deleted_at) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');

  const blocked = db.prepare(
    'SELECT 1 FROM blocked_members WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)'
  ).get(me, other, other, me);
  if (blocked) return apiError(res, 403, 'BLOCKED', 'لا يمكن عرض هذا الملف');

  const card = publicCard(other);
  const settings = db.prepare('SELECT photo_visibility FROM user_settings WHERE user_id = ?').get(other) || { photo_visibility: 0 };
  const isFavorite = !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND favorite_id = ?').get(me, other);
  const liked = db.prepare("SELECT action FROM match_actions WHERE actor_id = ? AND target_id = ?").get(me, other);
  const likedMe = db.prepare("SELECT action FROM match_actions WHERE actor_id = ? AND target_id = ? AND action = 'like'").get(other, me);

  res.json({
    profile: card,
    photoVisibility: settings.photo_visibility,
    viewerLiked: !!liked && liked.action === 'like',
    viewerPassed: !!liked && liked.action === 'pass',
    likedViewer: !!likedMe,
    isFavorite,
  });
});

export default router;
