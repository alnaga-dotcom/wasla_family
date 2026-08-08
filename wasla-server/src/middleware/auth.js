import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { isDeleted, isInGrace } from '../account.js';
import { ah } from '../async-handler.js';

async function resolveSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  return db.prepare(
    'SELECT s.user_id, s.expires_at, u.status, u.deleted_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).get(token);
}

function badSession(res, row) {
  if (!row) return apiError(res, 401, 'INVALID_SESSION', 'الجلسة غير صالحة');
  if (new Date(row.expires_at + 'Z') < new Date()) return apiError(res, 401, 'SESSION_EXPIRED', 'انتهت الجلسة — سجل الدخول مجددًا');
  if (row.status !== 'active') return apiError(res, 403, 'ACCOUNT_NOT_ACTIVE', 'الحساب غير نشط');
  return null;
}

export const authRequired = ah(async (req, res, next) => {
  const row = await resolveSession(req);
  const err = badSession(res, row);
  if (err) return err;
  if (isDeleted(row)) return apiError(res, 403, 'ACCOUNT_DELETED', 'هذا الحساب قيد الحذف — يمكنك استرجاعه خلال مهلة الحذف', 'account');
  req.userId = row.user_id;
  next();
});

// مسارات خاصة بالحساب (استرجاع/تصدير): تسمح للمحذوف خلال المهلة
export const authGrace = ah(async (req, res, next) => {
  const row = await resolveSession(req);
  const err = badSession(res, row);
  if (err) return err;
  if (isDeleted(row) && !isInGrace(row.deleted_at)) {
    return apiError(res, 410, 'ACCOUNT_PURGED', 'انتهت مهلة الحذف — لم يعد بالإمكان الاسترجاع', 'account');
  }
  req.userId = row.user_id;
  next();
});

// Phase 1 gate: search + chat require verified email (Wasla progressive verification)
export const emailVerifiedRequired = ah(async (req, res, next) => {
  const u = await db.prepare('SELECT email, email_verified_at FROM users WHERE id = ?').get(req.userId);
  if (!u || !u.email_verified_at) {
    return apiError(res, 403, 'EMAIL_VERIFICATION_REQUIRED', 'فعّل بريدك الإلكتروني من صفحة الملف للوصول إلى البحث والمراسلة', 'email');
  }
  next();
});
