import { Router } from 'express';
import { randomInt, randomBytes } from 'node:crypto';
import { db, nowIso } from '../db.js';
import { config } from '../config.js';
import { apiError, normalizePhone } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { completionFor, isValidFieldValue } from '../fields.js';
import { publish } from '../events.js';
import { startInstance, transition } from '../workflows.js';
import { sendOtp } from '../otp/send.js';
import { check as checkModeration } from '../moderation.js';

const router = Router();

function saveProfileField(userId, fieldKey, value) {
  const check = isValidFieldValue(fieldKey, value);
  if (!check.ok) return;
  const sensitive = fieldKey === 'health' ? 1 : 0;
  db.prepare(
    `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, field_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(userId, fieldKey, check.value, 'registration', sensitive, nowIso());
}

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
  const u = db.prepare('SELECT id, name, phone, email, gender, status, role, trust_level, email_verified_at, phone_verified_at, verified_at, created_at FROM users WHERE id = ?').get(userId);
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    gender: u.gender,
    status: u.status,
    role: u.role,
    trustLevel: u.trust_level,
    emailVerified: !!u.email_verified_at,
    phoneVerified: !!u.phone_verified_at,
    verified: !!u.verified_at,
    createdAt: u.created_at,
  };
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

// POST /api/auth/register  { name, phone, email?, gender, fields? }  → instant account, no email verification
router.post('/register', async (req, res) => {
  const { name, phone, email, gender, fields } = req.body || {};
  if (!name || String(name).trim().length < 3 || String(name).trim().length > 60) {
    return apiError(res, 422, 'INVALID_NAME', 'الاسم يجب أن يكون بين ٣ و٦٠ حرفًا', 'name');
  }
  const modName = checkModeration(String(name).trim());
  if (!modName.allowed) {
    return apiError(res, 422, 'NAME_MODERATION_REJECT', 'الاسم يحتوي على كلمات غير لائقة. الرجاء اختيار اسم مهذب.', 'name', { violations: modName.violations });
  }
  const norm = normalizePhone(phone);
  if (!norm) return apiError(res, 422, 'INVALID_PHONE', 'رقم هاتف غير صالح — محلي (01xxxxxxxxx) أو دولي (+رمز الدولة...)', 'phone');
  if (gender !== 'male' && gender !== 'female') {
    return apiError(res, 422, 'INVALID_GENDER', 'اختر الجنس (male / female)', 'gender');
  }
  const emailNorm = String(email || '').trim() || null;
  if (emailNorm && !isValidEmail(emailNorm)) {
    return apiError(res, 422, 'INVALID_EMAIL', 'البريد الإلكتروني غير صالح', 'email');
  }

  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(norm);
  if (existing && existing.status === 'active') {
    return apiError(res, 409, 'ALREADY_REGISTERED', 'هذا الرقم مسجل بالفعل — سجّل الدخول برمز التحقق', 'phone');
  }

  let userId;
  if (existing) {
    userId = existing.id;
    db.prepare('UPDATE users SET status = ?, name = ?, gender = ?, email = COALESCE(?, email) WHERE id = ?')
      .run('active', String(name).trim(), gender, emailNorm, userId);
  } else {
    const r = db.prepare('INSERT INTO users (name, phone, email, gender, status) VALUES (?, ?, ?, ?, ?)')
      .run(String(name).trim(), norm, emailNorm, gender, 'active');
    userId = Number(r.lastInsertRowid);
  }

  if (fields && typeof fields === 'object') {
    for (const [fieldKey, value] of Object.entries(fields)) {
      if (value === undefined || value === null || value === '') continue;
      saveProfileField(userId, fieldKey, value);
    }
  }

  const token = issueSession(userId);
  publish('UserRegistered', { userId, name: String(name).trim(), gender }, 'api', { userId, entityType: 'user', entityId: String(userId) });
  publish('UserLoggedIn', { userId, via: 'register' }, 'api', { userId, entityType: 'user', entityId: String(userId) });
  try {
    const inst = startInstance('account', 'user', userId, { name: String(name).trim(), gender }, 'registered');
    transition(inst.instanceId, 'active', { actorId: userId, reason: 'instant_register' });
  } catch (e) { /* workflow may already be advanced */ }

  res.status(201).json({ token, user: publicUser(userId) });
});

// POST /api/auth/email/request  { email }  → attach email + send verification OTP (Phase 1)
router.post('/email/request', authRequired, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim();
  if (!isValidEmail(email)) {
    return apiError(res, 422, 'INVALID_EMAIL', 'البريد الإلكتروني غير صالح', 'email');
  }
  const other = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.userId);
  if (other) {
    return apiError(res, 409, 'EMAIL_TAKEN', 'هذا البريد مسجل لعضو آخر', 'email');
  }
  db.prepare('UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?').run(email, req.userId);
  const code = issueOtp(req.userId, 'email_verify');
  try {
    await sendOtp({ phone: db.prepare('SELECT phone FROM users WHERE id = ?').get(req.userId).phone, email, code, channel: 'email' });
  } catch (err) {
    console.error('OTP send failed:', err && err.response ? err.response : (err && err.message));
    return apiError(res, 502, 'OTP_SEND_FAILED', 'تعذر إرسال رمز التحقق، جرّب مرة أخرى', 'email');
  }
  const dev = config.devOtpEcho ? { otp: code, note: 'dev only — يظهر في الرد للتجربة المحلية فقط' } : undefined;
  res.json({ sent: true, expiresInSec: config.otpExpiryMs / 1000, dev });
});

// POST /api/auth/email/verify  { code }  → confirm email (Phase 1)
router.post('/email/verify', authRequired, (req, res) => {
  const code = String((req.body && req.body.code) || '').trim();
  if (!/^\d{6}$/.test(code)) return apiError(res, 422, 'INVALID_CODE', 'أدخل رمز التحقق المكوّن من ٦ أرقام', 'code');

  const otp = db.prepare(
    `SELECT * FROM otp_codes WHERE user_id = ? AND purpose = 'email_verify' AND used_at IS NULL
     ORDER BY id DESC LIMIT 1`
  ).get(req.userId);

  if (!otp || otp.code !== code) return apiError(res, 401, 'WRONG_CODE', 'الرمز غير صحيح', 'code');
  if (new Date(otp.expires_at + 'Z') < new Date()) return apiError(res, 401, 'CODE_EXPIRED', 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا', 'code');

  db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(nowIso(), otp.id);
  db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(nowIso(), req.userId);
  publish('EmailVerified', { userId: req.userId }, 'api', { userId: req.userId, entityType: 'user', entityId: String(req.userId) });
  res.json({ ok: true, user: publicUser(req.userId) });
});

// POST /api/auth/phone/request  → send verification OTP to the phone via WhatsApp (Phase 2)
router.post('/phone/request', authRequired, async (req, res) => {
  const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.userId);
  const code = issueOtp(req.userId, 'phone_verify');
  try {
    await sendOtp({ phone: user.phone, code, channel: 'phone' });
  } catch (err) {
    console.error('OTP send failed:', err && err.response ? err.response : (err && err.message));
    return apiError(res, 502, 'OTP_SEND_FAILED', 'تعذر إرسال رمز التحقق — ستتمكن من تفعيل رقمك عند تفعيل واتساب', 'phone');
  }
  const dev = config.devOtpEcho ? { otp: code, note: 'dev only — يظهر في الرد للتجربة المحلية فقط' } : undefined;
  res.json({ sent: true, channel: 'phone', expiresInSec: config.otpExpiryMs / 1000, dev });
});

// POST /api/auth/phone/verify  { code }  → confirm the phone number (Phase 2)
router.post('/phone/verify', authRequired, (req, res) => {
  const code = String((req.body && req.body.code) || '').trim();
  if (!/^\d{6}$/.test(code)) return apiError(res, 422, 'INVALID_CODE', 'أدخل رمز التحقق المكوّن من ٦ أرقام', 'code');

  const otp = db.prepare(
    `SELECT * FROM otp_codes WHERE user_id = ? AND purpose = 'phone_verify' AND used_at IS NULL
     ORDER BY id DESC LIMIT 1`
  ).get(req.userId);

  if (!otp || otp.code !== code) return apiError(res, 401, 'WRONG_CODE', 'الرمز غير صحيح', 'code');
  if (new Date(otp.expires_at + 'Z') < new Date()) return apiError(res, 401, 'CODE_EXPIRED', 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا', 'code');

  db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(nowIso(), otp.id);
  db.prepare('UPDATE users SET phone_verified_at = ? WHERE id = ?').run(nowIso(), req.userId);
  publish('PhoneVerified', { userId: req.userId }, 'api', { userId: req.userId, entityType: 'user', entityId: String(req.userId) });
  res.json({ ok: true, user: publicUser(req.userId) });
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
  if (!user.email) {
    return apiError(res, 422, 'EMAIL_MISSING', 'أضف بريدك الإلكتروني وتفعيله من صفحة الملف، ثم سجّل الدخول برمز التحقق', 'phone');
  }

  const code = issueOtp(user.id, 'login');
  try {
    await sendOtp({ phone: norm, email: user.email, code, channel: 'email' });
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
