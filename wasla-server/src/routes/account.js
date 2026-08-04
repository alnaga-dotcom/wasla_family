import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired, authGrace } from '../middleware/auth.js';
import { isDeleted, isInGrace, restoreBy, deleteGraceMs, exportData } from '../account.js';

const router = Router();

// GET /api/me/account/status — حالة الحساب (للتراجع عند إعادة الدخول)
router.get('/me/account/status', authGrace, (req, res) => {
  const u = db.prepare('SELECT deleted_at FROM users WHERE id = ?').get(req.userId);
  const deleted = isDeleted(u);
  res.json({
    deleted,
    restoreBy: deleted ? restoreBy(u.deleted_at) : null,
    graceDays: Math.round(deleteGraceMs() / (24 * 60 * 60 * 1000)),
  });
});

// DELETE /api/me/account — حذف الحساب مع مهلة تراجع ٣٠ يومًا (Wasla_22)
router.delete('/me/account', authRequired, (req, res) => {
  const reason = (req.body && req.body.reason ? String(req.body.reason) : '').trim();
  const deletedAt = new Date(Date.now() + deleteGraceMs()).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').run(deletedAt, req.userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId);
  if (reason) db.prepare('UPDATE users SET deleted_at = deleted_at WHERE id = ?').run(req.userId); // no-op guard
  res.json({
    deleted: true,
    restoreBy: restoreBy(deletedAt),
    message: 'حُذف حسابك. يمكنك التراجع خلال مهلة الحذف قبل الحذف النهائي.',
  });
});

// POST /api/me/account/restore — استرجاع الحساب قبل انتهاء المهلة
router.post('/me/account/restore', authGrace, (req, res) => {
  const u = db.prepare('SELECT deleted_at FROM users WHERE id = ?').get(req.userId);
  if (!isDeleted(u)) return res.json({ restored: false, alreadyActive: true });
  if (!isInGrace(u.deleted_at)) {
    return apiError(res, 410, 'ACCOUNT_PURGED', 'انتهت مهلة الحذف — لا يمكن الاسترجاع', 'account');
  }
  db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(req.userId);
  res.json({ restored: true, message: 'أُعيد تنشيط حسابك بنجاح.' });
});

// GET /api/me/data — تصدير كل بياناتك (JSON) لمغادرة أو نقل أو احتفاظ (Wasla_22)
router.get('/me/data', authGrace, (req, res) => {
  const data = exportData(req.userId);
  if (!data) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  res.json(data);
});

export default router;
