import { Router } from 'express';
import { db } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { unreadCount } from '../notify.js';

const router = Router();

// GET /api/notifications
router.get('/notifications', authRequired, (req, res) => {
  const rows = db.prepare(
    `SELECT n.id, n.type, n.text, n.from_user_id, n.is_read, n.created_at, u.name AS from_name
     FROM notifications n LEFT JOIN users u ON u.id = n.from_user_id
     WHERE n.user_id = ?
     ORDER BY n.id DESC LIMIT 50`
  ).all(req.userId);
  res.json({ notifications: rows, unread: unreadCount(req.userId) });
});

// POST /api/notifications/read  { id? } — id اختياريًا؛ بدونه يُعلَّم الكل كمقروءة
router.post('/notifications/read', authRequired, (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  if (Number.isInteger(id) && id > 0) {
    const r = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?')
      .run(req.userId, id);
    if (r.changes === 0) return apiError(res, 404, 'NOTIFICATION_NOT_FOUND', 'الإشعار غير موجود', 'id');
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
  }
  res.json({ ok: true, unread: unreadCount(req.userId) });
});

export default router;
