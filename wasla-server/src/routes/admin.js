import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db, nowIso } from '../db.js';
import { ah } from '../async-handler.js';
import { apiError, normalizePhone } from '../validate.js';
import { adminRequired, permissionRequired } from '../middleware/admin.js';
import { hasPermission } from '../permissions.js';
import { getQueue, resolveItem, itemById, maskedText } from '../moderation.js';
import { listWeights, saveWeights, saveThreshold } from '../matching.js';
import { listEvents, publish } from '../events.js';
import { listDefinitions, listInstances, createDefinition, startInstance, transition, getInstance } from '../workflows.js';
import { listRules, createRule, updateRule, testRule } from '../rules.js';
import { listConfig, saveConfig } from '../recommendations.js';
import { listPermissions, listAllRoles, listAllPermissions, isStaff } from '../permissions.js';
import { runDesignReview } from '../design-review.js';
import { getPendingPhotos, approvePhoto, rejectPhoto, photoUrl } from '../uploads.js';
import { notify } from '../notify.js';
import { config } from '../config.js';

const router = Router();

async function logAction(actor, action, targetType, targetId, reason, meta) {
  await db.prepare(
    `INSERT INTO admin_actions (actor_id, actor_role, action, target_type, target_id, reason, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    actor.userId || null,
    actor.role,
    action,
    targetType,
    String(targetId || ''),
    reason || null,
    meta ? JSON.stringify(meta) : null
  );
}

function actorFrom(req) {
  return req.adminContext || { role: 'system' };
}

// --- Dedicated admin panel login (username/password, independent of user accounts) ---
function safeEq(a, b) {
  const ba = Buffer.from(String(a == null ? '' : a));
  const bb = Buffer.from(String(b == null ? '' : b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function bearerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

const loginAttempts = new Map();
function rateLimitLogin(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + 5 * 60 * 1000 };
    loginAttempts.set(ip, rec);
  }
  rec.count += 1;
  return rec.count;
}

// POST /admin/login { username, password } → admin panel token (super_admin context)
router.post('/login', ah(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (rateLimitLogin(ip) > 5) {
    return apiError(res, 429, 'ADMIN_LOGIN_LIMIT', 'محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة');
  }
  const { username, password } = req.body || {};
  if (!safeEq(username, config.adminUser) || !safeEq(password, config.adminPass)) {
    return apiError(res, 401, 'ADMIN_BAD_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionTtlMs).toISOString().replace('T', ' ').slice(0, 19);
  await db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expires);
  res.json({ token, expiresAt: expires, role: 'super_admin' });
}));

// POST /admin/logout — revoke the current admin token
router.post('/logout', ah(async (req, res) => {
  const token = bearerToken(req);
  if (token) await db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  res.json({ ok: true });
}));

// GET /admin/me — validate an admin panel token
router.get('/me', ah(async (req, res) => {
  const token = bearerToken(req);
  if (!token) return apiError(res, 401, 'ADMIN_SESSION_INVALID', 'جلسة الأدمن غير صالحة');
  const row = await db.prepare('SELECT token, expires_at FROM admin_sessions WHERE token = ?').get(token);
  if (!row || new Date(row.expires_at + 'Z') <= new Date()) {
    return apiError(res, 401, 'ADMIN_SESSION_INVALID', 'انتهت جلسة الأدمن — سجّل الدخول مجددًا');
  }
  res.json({ role: 'super_admin', expiresAt: row.expires_at });
}));

// GET /admin/roles
router.get('/roles', adminRequired, ah(async (req, res) => {
  const ctx = req.adminContext;
  const roles = await Promise.all(listAllRoles().map(async (role) => ({ role, permissions: await listPermissions(role) })));
  res.json({ actorRole: ctx.role, roles });
}));

// GET /admin/permissions
router.get('/permissions', adminRequired, ah(async (req, res) => {
  res.json({ permissions: await listAllPermissions() });
}));

// GET /admin/design-review
router.get('/design-review', permissionRequired('dashboard','view'), ah(async (req, res) => {
  res.json(await runDesignReview());
}));

// GET /admin/dashboard
router.get('/dashboard', permissionRequired('dashboard','view'), ah(async (req, res) => {
  const users = (await db.prepare('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL AND status = ?').get('active')).c;
  const reports = (await db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'").get()).c;
  const payments = (await db.prepare("SELECT COALESCE(SUM(amount_egp),0) AS total FROM payments WHERE status = 'paid'").get()).total;
  const subs = (await db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active'").get()).c;
  res.json({ users, pendingReports: reports, revenueEgp: payments, activeSubscriptions: subs });
}));

// GET /admin/reports
router.get('/reports', permissionRequired('queues','view'), ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT r.id, r.reporter_id, r.reported_id, r.reason, r.status, r.created_at,
            u1.name AS reporter_name, u2.name AS reported_name
     FROM reports r
     JOIN users u1 ON u1.id = r.reporter_id
     JOIN users u2 ON u2.id = r.reported_id
     ORDER BY r.created_at DESC LIMIT 200`
  ).all();
  res.json({ reports: rows });
}));

// POST /admin/reports/:id/resolve { status, reason }
router.post('/reports/:id/resolve', permissionRequired('users','restrict'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { status, reason } = req.body || {};
  if (!['pending', 'resolved', 'dismissed'].includes(status)) {
    return apiError(res, 422, 'INVALID_STATUS', 'حالة غير صالحة', 'status');
  }
  await db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
  await logAction(actorFrom(req), 'report_resolve', 'report', id, reason, { status });
  res.json({ ok: true, reportId: id, status });
}));

// GET /admin/users?status=&q=
router.get('/users', permissionRequired('users','search'), ah(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = 'WHERE deleted_at IS NULL';
  if (['active', 'pending', 'suspended'].includes(status)) { where += ' AND status = ?'; params.push(status); }
  if (q) { where += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  const rows = await db.prepare(
    `SELECT id, name, phone, gender, status, role, created_at
     FROM users ${where}
     ORDER BY id DESC LIMIT 200`
  ).all(...params);
  res.json({ users: rows });
}));

// POST /admin/users — create a member account directly (staff/test accounts, no OTP)
router.post('/users', permissionRequired('users','manage'), ah(async (req, res) => {
  const { name, phone, email, gender, role } = req.body || {};
  if (!name || String(name).trim().length < 3 || String(name).trim().length > 60) {
    return apiError(res, 422, 'INVALID_NAME', 'الاسم يجب أن يكون بين ٣ و٦٠ حرفًا', 'name');
  }
  const norm = normalizePhone(phone);
  if (!norm) return apiError(res, 422, 'INVALID_PHONE', 'رقم هاتف غير صالح', 'phone');
  if (gender !== 'male' && gender !== 'female') return apiError(res, 422, 'INVALID_GENDER', 'اختر الجنس', 'gender');
  const allowedRoles = ['user', 'viewer', 'moderator', 'verification_officer', 'customer_support', 'rule_admin', 'subscription_admin', 'admin'];
  if (!allowedRoles.includes(role)) return apiError(res, 422, 'INVALID_ROLE', 'دور غير صالح', 'role');
  const emailNorm = String(email || '').trim() || null;
  if (emailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return apiError(res, 422, 'INVALID_EMAIL', 'بريد إلكتروني غير صالح', 'email');
  }
  const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').get(norm);
  if (existing) return apiError(res, 409, 'ALREADY_REGISTERED', 'رقم الهاتف مسجل بالفعل', 'phone');
  const r = await db.prepare(
    `INSERT INTO users (name, phone, email, gender, status, role, email_verified_at, phone_verified_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
  ).run(String(name).trim(), norm, emailNorm, gender, role, nowIso(), nowIso());
  const userId = Number(r.lastInsertRowid);
  await logAction(actorFrom(req), 'user_create', 'user', userId, 'أنشئ من لوحة الإدارة', { role, phone: norm });
  res.status(201).json({ ok: true, userId, phone: norm });
}));

// GET /admin/violators — suspended members with their reports/moderation history
router.get('/violators', permissionRequired('users','search'), ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT u.id, u.name, u.phone, u.gender, u.role, u.created_at,
            (SELECT COUNT(*) FROM reports r WHERE r.reported_id = u.id) AS reports_count,
            (SELECT COUNT(*) FROM moderation_items m WHERE m.user_id = u.id AND m.status = 'rejected') AS moderation_count,
            (SELECT r2.reason FROM reports r2 WHERE r2.reported_id = u.id ORDER BY r2.created_at DESC LIMIT 1) AS last_reason
     FROM users u
     WHERE u.deleted_at IS NULL AND u.status = 'suspended'
     ORDER BY u.id DESC LIMIT 200`
  ).all();
  res.json({ violators: rows });
}));

// POST /admin/reports/:id/ban — suspend the reported member + resolve the report
router.post('/reports/:id/ban', permissionRequired('users','restrict'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  const report = await db.prepare('SELECT id, reported_id, status FROM reports WHERE id = ?').get(id);
  if (!report) return apiError(res, 404, 'REPORT_NOT_FOUND', 'البلاغ غير موجود');
  if (!report.reported_id) return apiError(res, 422, 'INVALID_REPORT', 'بلاغ غير صالح');
  const target = await db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(report.reported_id);
  if (!target) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  await db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(report.reported_id);
  await db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(id);
  await logAction(actorFrom(req), 'user_ban_from_report', 'user', report.reported_id, reason || 'حظر من البلاغ', { reportId: id });
  res.json({ ok: true, userId: report.reported_id, reportId: id, status: 'suspended' });
}));

// GET /admin/users/:id
router.get('/users/:id', permissionRequired('users','search'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const user = await db.prepare(
    `SELECT id, name, phone, gender, status, role, created_at FROM users WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
  if (!user) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  const reports = (await db.prepare('SELECT COUNT(*) AS c FROM reports WHERE reported_id = ?').get(id)).c;
  const trust = await db.prepare('SELECT trust_level FROM users WHERE id = ?').get(id);
  res.json({ user, reportsAgainst: reports, trustLevel: trust?.trust_level || null });
}));

// POST /admin/users/:id/suspend { reason }
router.post('/users/:id/suspend', permissionRequired('users','restrict'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  if (!reason) return apiError(res, 422, 'REASON_REQUIRED', 'سبب الإيقاف مطلوب', 'reason');
  await db.prepare("UPDATE users SET status = 'suspended' WHERE id = ? AND deleted_at IS NULL").run(id);
  await logAction(actorFrom(req), 'user_suspend', 'user', id, reason);
  res.json({ ok: true, userId: id, status: 'suspended' });
}));

// POST /admin/users/:id/unsuspend { reason }
router.post('/users/:id/unsuspend', permissionRequired('users','restrict'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  await db.prepare("UPDATE users SET status = 'active' WHERE id = ? AND deleted_at IS NULL").run(id);
  await logAction(actorFrom(req), 'user_unsuspend', 'user', id, reason);
  res.json({ ok: true, userId: id, status: 'active' });
}));

// POST /admin/users/:id/role { role, reason }
router.post('/users/:id/role', permissionRequired('roles','manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { role, reason } = req.body || {};
  const allowed = ['user', 'viewer', 'moderator', 'verification_officer', 'customer_support', 'rule_admin', 'subscription_admin', 'admin', 'super_admin'];
  if (!allowed.includes(role)) return apiError(res, 422, 'INVALID_ROLE', 'دور غير صالح', 'role');
  const ctx = req.adminContext;
  if (!ctx || ctx.role !== 'super_admin') {
    return apiError(res, 403, 'SUPER_ADMIN_REQUIRED', 'تغيير الأدوار يتطلب super_admin');
  }
  await db.prepare('UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL').run(role, id);
  await logAction(actorFrom(req), 'user_role_change', 'user', id, reason, { role });
  res.json({ ok: true, userId: id, role });
}));

// GET /admin/plans
router.get('/plans', permissionRequired('dashboard','view'), ah(async (req, res) => {
  const rows = await db.prepare('SELECT * FROM plans ORDER BY price_egp').all();
  res.json({ plans: rows.map((p) => ({ ...p, features: JSON.parse(p.features || '[]') })) });
}));

// PATCH /admin/plans/:code { name, priceEgp, regularPriceEgp, status, features }
router.patch('/plans/:code', permissionRequired('plans','manage'), ah(async (req, res) => {
  const code = req.params.code;
  const { name, priceEgp, regularPriceEgp, status, features } = req.body || {};
  const current = await db.prepare('SELECT * FROM plans WHERE code = ?').get(code);
  if (!current) return apiError(res, 404, 'PLAN_NOT_FOUND', 'الخطة غير موجودة');

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (typeof priceEgp === 'number') { updates.push('price_egp = ?'); params.push(priceEgp); }
  if (typeof regularPriceEgp === 'number') { updates.push('regular_price_egp = ?'); params.push(regularPriceEgp); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (features) { updates.push('features = ?'); params.push(JSON.stringify(features)); }
  if (updates.length === 0) return apiError(res, 422, 'NO_FIELDS', 'لا توجد حقول للتحديث');

  params.push(code);
  await db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE code = ?`).run(...params);
  await logAction(actorFrom(req), 'plan_update', 'plan', code, null, req.body);
  res.json({ ok: true, planCode: code });
}));

// GET /admin/payments
router.get('/payments', permissionRequired('audit','view'), ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT p.id, p.user_id, u.name AS user_name, p.subscription_id, p.amount_egp, p.provider, p.status, p.created_at
     FROM payments p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.id DESC LIMIT 200`
  ).all();
  res.json({ payments: rows });
}));

// GET /admin/subscriptions
router.get('/subscriptions', permissionRequired('audit','view'), ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT s.*, u.name AS user_name, p.name AS plan_name
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     JOIN plans p ON p.code = s.plan_code
     ORDER BY s.id DESC LIMIT 200`
  ).all();
  res.json({ subscriptions: rows });
}));

// GET /admin/audit-log
router.get('/audit-log', permissionRequired('audit','view'), ah(async (req, res) => {
  const rows = await db.prepare(
    'SELECT * FROM admin_actions ORDER BY id DESC LIMIT 200'
  ).all();
  res.json({ actions: rows });
}));

// GET /admin/matching/weights
router.get('/matching/weights', permissionRequired('dashboard','view'), ah(async (req, res) => {
  res.json(await listWeights());
}));

// POST /admin/matching/weights { weights }
router.post('/matching/weights', permissionRequired('config','manage'), ah(async (req, res) => {
  const { weights } = req.body || {};
  if (!weights || typeof weights !== 'object') return apiError(res, 422, 'INVALID_WEIGHTS', 'أوزان غير صالحة', 'weights');
  await saveWeights(weights);
  await logAction(actorFrom(req), 'matching_weights_update', 'config', 'match_weights', null, weights);
  res.json({ ok: true });
}));

// POST /admin/matching/threshold { threshold }
router.post('/matching/threshold', permissionRequired('config','manage'), ah(async (req, res) => {
  const threshold = Number((req.body || {}).threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    return apiError(res, 422, 'INVALID_THRESHOLD', 'عتبة غير صالحة', 'threshold');
  }
  await saveThreshold(threshold);
  await logAction(actorFrom(req), 'matching_threshold_update', 'config', 'match_threshold', null, { threshold });
  res.json({ ok: true, threshold });
}));

// GET /admin/moderation?status=pending&limit=200
router.get('/moderation', permissionRequired('queues','view'), ah(async (req, res) => {
  const status = req.query.status || 'pending';
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const rows = (await getQueue(status, limit)).map((it) => ({
    ...it,
    violations: JSON.parse(it.violations || '[]'),
    originalText: maskedText(it.original_text),
  }));
  res.json({ items: rows });
}));

// POST /admin/moderation/:id/resolve { action: 'approve'|'reject'|'overturn', reason }
router.post('/moderation/:id/resolve', adminRequired, ah(async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!['approve', 'reject', 'overturn'].includes(action)) {
    return apiError(res, 422, 'INVALID_ACTION', 'إجراء غير صالح', 'action');
  }
  const item = await itemById(id);
  if (!item) return apiError(res, 404, 'ITEM_NOT_FOUND', 'العنصر غير موجود');
  const ctx = actorFrom(req);
  const requiredPerm = action === 'overturn' ? 'content.override' : 'content.review';
  const [resource, act] = requiredPerm.split('.');
  if (!await hasPermission(ctx.role, resource, act)) {
    return apiError(res, 403, 'ADMIN_REQUIRED', `يتطلب صلاحية ${requiredPerm}`);
  }
  const result = await resolveItem(id, action, ctx.userId || null, ctx.role, reason);
  await logAction(ctx, 'moderation_' + action, 'moderation_item', id, reason, { status: result.status });
  res.json({ ok: true, itemId: id, status: result.status });
}));

// GET /admin/photos?status=pending — avatar review queue
router.get('/photos', permissionRequired('queues','view'), ah(async (req, res) => {
  const status = req.query.status || 'pending';
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const rows = (await getPendingPhotos(status, limit)).map((p) => ({
    id: p.id,
    userId: p.user_id,
    userName: p.user_name,
    userPhone: p.user_phone,
    kind: p.kind,
    url: photoUrl(p),
    reviewStatus: p.review_status,
    reviewedAt: p.reviewed_at,
    reviewReason: p.review_reason,
    createdAt: p.created_at,
  }));
  res.json({ items: rows });
}));

// POST /admin/photos/:id/decision { action: 'approve'|'reject', reason }
router.post('/photos/:id/decision', adminRequired, ah(async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return apiError(res, 422, 'INVALID_ACTION', 'إجراء غير صالح', 'action');
  }
  const ctx = actorFrom(req);
  const result = action === 'approve' ? await approvePhoto(id, ctx.userId || null) : await rejectPhoto(id, ctx.userId || null, reason);
  if (!result.ok) return apiError(res, 404, 'PHOTO_NOT_PENDING', 'الصورة غير موجودة أو ليست بانتظار المراجعة');
  await notify(result.userId, 'system', action === 'approve' ? 'تمت الموافقة على صورتك الرمزية ✓' : 'عُرضت صورتك الرمزية عن المراجعة — أعد رفع صورة أخرى');
  await logAction(ctx, 'photo_' + action, 'user_photo', id, reason, { status: action });
  res.json({ ok: true, photoId: id, status: action });
}));

// GET /admin/events?type=&entityType=&entityId=&limit=
router.get('/events', permissionRequired('queues','view'), ah(async (req, res) => {
  const events = await listEvents({
    type: req.query.type,
    entityType: req.query.entityType,
    entityId: req.query.entityId,
    limit: Number(req.query.limit) || 100,
  });
  res.json({ events });
}));

// POST /admin/events/publish { type, payload, userId, entityType, entityId }
router.post('/events/publish', permissionRequired('config','manage'), ah(async (req, res) => {
  const { type, payload, userId, entityType, entityId } = req.body || {};
  if (!type) return apiError(res, 422, 'MISSING_TYPE', 'نوع الحدث مطلوب', 'type');
  const id = await publish(type, payload || {}, 'admin', { userId, entityType, entityId });
  await logAction(actorFrom(req), 'event_publish', 'event', id, null, { type });
  res.status(201).json({ eventId: id });
}));

// GET /admin/workflows
router.get('/workflows', permissionRequired('dashboard','view'), ah(async (req, res) => {
  res.json({ definitions: await listDefinitions(), instances: await listInstances({ limit: Number(req.query.limit) || 100 }) });
}));

// POST /admin/workflows { key, version, name, states, transitions }
router.post('/workflows', permissionRequired('workflows','manage'), ah(async (req, res) => {
  const { key, version, name, states, transitions } = req.body || {};
  if (!key || !name || !Array.isArray(states) || !Array.isArray(transitions)) {
    return apiError(res, 422, 'INVALID_DEFINITION', 'تعريف workflow غير صالح');
  }
  const id = await createDefinition({ key, version: Number(version) || 1, name, states, transitions, status: 'published' });
  await logAction(actorFrom(req), 'workflow_create', 'workflow', id, null, { key, version });
  res.status(201).json({ id });
}));

// POST /admin/workflows/:id/instances { entityType, entityId, context }
router.post('/workflows/:id/instances', permissionRequired('workflows','manage'), ah(async (req, res) => {
  const defId = Number(req.params.id);
  const def = await getInstance(defId);
  if (!def) return apiError(res, 404, 'DEFINITION_NOT_FOUND', 'تعريف workflow غير موجود');
  const { entityType, entityId, context } = req.body || {};
  if (!entityType || !entityId) return apiError(res, 422, 'MISSING_ENTITY', 'الكيان مطلوب');
  const result = await startInstance(def.definition.wf_key, entityType, entityId, context || {});
  res.status(201).json(result);
}));

// POST /admin/workflows/instances/:id/transition { toState, reason }
router.post('/workflows/instances/:id/transition', permissionRequired('workflows','manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { toState, reason } = req.body || {};
  if (!toState) return apiError(res, 422, 'MISSING_STATE', 'الحالة المستهدفة مطلوبة');
  const ctx = actorFrom(req);
  const result = await transition(id, toState, { actorId: ctx.userId || null, actorRole: ctx.role, reason });
  await logAction(ctx, 'workflow_transition', 'workflow_instance', id, reason, { toState });
  res.json(result);
}));

// GET /admin/rules
router.get('/rules', permissionRequired('dashboard','view'), ah(async (req, res) => {
  res.json({ rules: await listRules({ eventType: req.query.eventType, status: req.query.status }) });
}));

// POST /admin/rules { name, description, eventType, conditions, actions, priority, status, userMessage, sensitive }
router.post('/rules', permissionRequired('rules','manage'), ah(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.eventType || !Array.isArray(body.conditions) || !Array.isArray(body.actions)) {
    return apiError(res, 422, 'INVALID_RULE', 'قاعدة غير صالحة');
  }
  const id = await createRule({
    name: body.name,
    description: body.description,
    eventType: body.eventType,
    conditions: body.conditions,
    actions: body.actions,
    priority: Number(body.priority) || 0,
    status: body.status || 'active',
    userMessage: body.userMessage,
    sensitive: !!body.sensitive,
  });
  await logAction(actorFrom(req), 'rule_create', 'rule', id, null, { name: body.name, eventType: body.eventType });
  res.status(201).json({ id });
}));

// POST /admin/rules/:id/enable or /disable
router.post('/rules/:id/toggle', permissionRequired('rules','manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  await updateRule(id, { status: active ? 'active' : 'inactive' });
  await logAction(actorFrom(req), active ? 'rule_enable' : 'rule_disable', 'rule', id);
  res.json({ ok: true, id, status: active ? 'active' : 'inactive' });
}));

// POST /admin/rules/:id/test { context }
router.post('/rules/:id/test', permissionRequired('rules','manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const result = await testRule(id, req.body?.context || {});
  if (!result) return apiError(res, 404, 'RULE_NOT_FOUND', 'القاعدة غير موجودة');
  res.json({ result });
}));

// GET /admin/recommendations/config
router.get('/recommendations/config', permissionRequired('dashboard','view'), ah(async (req, res) => {
  res.json({ config: await listConfig() });
}));

// POST /admin/recommendations/config { config }
router.post('/recommendations/config', permissionRequired('config','manage'), ah(async (req, res) => {
  const { config } = req.body || {};
  if (!config || typeof config !== 'object') return apiError(res, 422, 'INVALID_CONFIG', 'إعدادات غير صالحة', 'config');
  await saveConfig(config);
  await logAction(actorFrom(req), 'recommendation_config_update', 'config', 'recommendation_config', null, config);
  res.json({ ok: true, config: await listConfig() });
}));

export default router;
