import { Router } from 'express';
import { randomInt, randomBytes } from 'node:crypto';
import { db, nowIso } from '../db.js';
import { config } from '../config.js';
import { apiError, normalizePhone } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { completionFor } from '../fields.js';
import { publish } from '../events.js';
import { startInstance, transition } from '../workflows.js';
import { sendOtp, OTP_PROVIDER } from '../otp/send.js';

const router = Router();

function issueOtp(userId, purpose) {
  const code = String(randomInt(100000, 999999));
  const expires = new Date(Date.now() + config.otpExpiryMs).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('INSERT INTO otp_codes (user_id, code, purpose, expires_at) VALUES (?, ?, ?, ?)')
    .run(userId, code, purpose, expires);
  return code;
}

function issueSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionTtlMs).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function publicUser(userId) {
  const u = db.prepare('SELECT id, name, phone, gender, status, role, trust_level, verified_at, created_at FROM users WHERE id = ?').get(userId);
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    gender: u.gender,
    status: u.status,
    role: u.role,
    trustLevel: u.trust_level,
    verified: !!u.verified_at,
    createdAt: u.created_at,
  };
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

// POST /api/auth/register  { name, phone, email?, gender }
router.post('/register', async (req, res) => {
  const { name, phone, email, gender } = req.body || {};
  if (!name || String(name).trim().length < 3 || String(name).trim().length > 60) {
    return apiError(res, 422, 'INVALID_NAME', 'الاسم يجب أن يكون بين ٣ و٦٠ حرفًا', 'name');
  }
  const norm = normalizePhone(phone);
  if (!norm) return apiError(res, 422, 'INVALID_PHONE', 'رقم هاتف غير صالح — محلي (01xxxxxxxxx) أو دولي (+رمز الدولة...)', 'phone');
  if (gender !== 'male' && gender !== 'female') {
    return apiError(res, 422, 'INVALID_GENDER', 'اختر الجنس (male / female)', 'gender');
  }
  const emailNorm = String(email || '').trim() || null;
  if (OTP_PROVIDER === 'email' && !isValidEmail(emailNorm)) {
    return apiError(res, 422, 'EMAIL_REQUIRED', 'البريد الإلكتروني مطلوب لإرسال رمز التحقق', 'email');
  }

  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(norm);
  if (existing && existing.status === 'active') {
    return apiError(res, 409, 'ALREADY_REGISTERED', 'هذا الرقم مسجل بالفعل — سجل الدخول برمز التحقق', 'phone');
  }

  let userId;
  if (existing) {
    userId = existing.id;
    if (emailNorm) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(emailNorm, userId);
    }
  } else {
    const r = db.prepare('INSERT INTO users (name, phone, email, gender) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), norm, emailNorm, gender);
    userId = Number(r.lastInsertRowid);
  }

  const code = issueOtp(userId, 'register');
  try {
    await sendOtp({ phone: norm, email: emailNorm, code });
  } catch (err) {
    console.error('OTP send failed:', err && err.response ? err.response : (err && err.message));
    return apiError(res, 502, 'OTP_SEND_FAILED', 'تعذر إرسال رمز التحقق، جرّب مرة أخرى', 'phone');
  }
  const dev = config.devOtpEcho ? { otp: code, note: 'dev only — يظهر في الرد للتجربة المحلية فقط' } : undefined;

  publish('UserRegistered', { userId, name: String(name).trim(), gender }, 'api', { userId, entityType: 'user', entityId: String(userId) });
  startInstance('account', 'user', userId, { name: String(name).trim(), gender }, 'registered');

  res.status(201).json({ userId, status: 'pending', expiresInSec: config.otpExpiryMs / 1000, dev });
});

// POST /api/auth/otp/verify  { phone, code }
router.post('/otp/verify', (req, res) => {
  const { phone, code } = req.body || {};
  const norm = normalizePhone(phone);
  if (!norm) return apiError(res, 422, 'INVALID_PHONE', 'رقم هاتف غير صالح — محلي (01xxxxxxxxx) أو دولي (+رمز الدولة...)', 'phone');
  if (!/^\d{6}$/.test(String(code || ''))) return apiError(res, 422, 'INVALID_CODE', 'أدخل رمز التحقق المكوّن من ٦ أرقام', 'code');

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(norm);
  if (!user) return apiError(res, 404, 'NOT_REGISTERED', 'هذا الرقم غير مسجل — أنشئ حسابًا أولًا', 'phone');

  const otp = db.prepare(
    `SELECT * FROM otp_codes WHERE user_id = ? AND purpose IN ('register','login') AND used_at IS NULL
     ORDER BY id DESC LIMIT 1`
  ).get(user.id);

  if (!otp || otp.code !== String(code)) return apiError(res, 401, 'WRONG_CODE', 'الرمز غير صحيح', 'code');
  if (new Date(otp.expires_at + 'Z') < new Date()) return apiError(res, 401, 'CODE_EXPIRED', 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا', 'code');

  db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(nowIso(), otp.id);
  if (user.status === 'pending') db.prepare('UPDATE users SET status = ? WHERE id = ?').run('active', user.id);

  publish('PhoneVerified', { userId: user.id }, 'api', { userId: user.id, entityType: 'user', entityId: String(user.id) });
  // Transition account workflow registered -> phone_verified -> active
  try {
    const inst = startInstance('account', 'user', user.id, {}, 'registered');
    transition(inst.instanceId, 'phone_verified', { actorId: user.id, reason: 'otp_verified' });
    transition(inst.instanceId, 'active', { actorId: user.id, reason: 'account_activated' });
  } catch (e) { /* workflow may already be advanced */ }

  const token = issueSession(user.id);
  publish('UserLoggedIn', { userId: user.id }, 'api', { userId: user.id, entityType: 'user', entityId: String(user.id) });
  res.json({ token, user: publicUser(user.id) });
});

// POST /api/auth/login  { phone }  → sends OTP (register-first flow)
router.post('/login', async (req, res) => {
  const { phone } = req.body || {};
  const norm = normalizePhone(phone);
  if (!norm) return apiError(res, 422, 'INVALID_PHONE', 'رقم هاتف غير صالح — محلي (01xxxxxxxxx) أو دولي (+رمز الدولة...)', 'phone');

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(norm);
  if (!user || user.status !== 'active') {
    return apiError(res, 404, 'NOT_REGISTERED', 'هذا الرقم غير مسجل — أنشئ حسابًا أولًا', 'phone');
  }

  const code = issueOtp(user.id, 'login');
  try {
    await sendOtp({ phone: norm, email: user.email, code });
  } catch (err) {
    return apiError(res, 502, 'OTP_SEND_FAILED', 'تعذر إرسال رمز التحقق، جرّب مرة أخرى', 'phone');
  }
  const dev = config.devOtpEcho ? { otp: code } : undefined;
  publish('UserLoggedIn', { userId: user.id, via: 'otp_request' }, 'api', { userId: user.id, entityType: 'user', entityId: String(user.id) });
  res.json({ userId: user.id, expiresInSec: config.otpExpiryMs / 1000, dev });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.userId) });
});

// POST /api/auth/logout
router.post('/logout', authRequired, (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

export default router;
