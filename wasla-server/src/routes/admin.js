import { Router } from 'express';
import { db } from '../db.js';
import { apiError } from '../validate.js';
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

const router = Router();

function logAction(actor, action, targetType, targetId, reason, meta) {
  db.prepare(
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

// GET /admin/roles
router.get('/roles', adminRequired, (req, res) => {
  const ctx = req.adminContext;
  const roles = listAllRoles().map((role) => ({ role, permissions: listPermissions(role) }));
  res.json({ actorRole: ctx.role, roles });
});

// GET /admin/permissions
router.get('/permissions', adminRequired, (req, res) => {
  res.json({ permissions: listAllPermissions() });
});

// GET /admin/design-review
router.get('/design-review', permissionRequired('dashboard','view'), (req, res) => {
  res.json(runDesignReview());
});

// GET /admin/dashboard
router.get('/dashboard', permissionRequired('dashboard','view'), (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL AND status = ?').get('active').c;
  const reports = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'").get().c;
  const payments = db.prepare("SELECT COALESCE(SUM(amount_egp),0) AS total FROM payments WHERE status = 'paid'").get().total;
  const subs = db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active'").get().c;
  res.json({ users, pendingReports: reports, revenueEgp: payments, activeSubscriptions: subs });
});

// GET /admin/reports
router.get('/reports', permissionRequired('queues','view'), (req, res) => {
  const rows = db.prepare(
    `SELECT r.id, r.reporter_id, r.reported_id, r.reason, r.status, r.created_at,
            u1.name AS reporter_name, u2.name AS reported_name
     FROM reports r
     JOIN users u1 ON u1.id = r.reporter_id
     JOIN users u2 ON u2.id = r.reported_id
     ORDER BY r.created_at DESC LIMIT 200`
  ).all();
  res.json({ reports: rows });
});

// POST /admin/reports/:id/resolve { status, reason }
router.post('/reports/:id/resolve', permissionRequired('users','restrict'), (req, res) => {
  const id = Number(req.params.id);
  const { status, reason } = req.body || {};
  if (!['pending', 'resolved', 'dismissed'].includes(status)) {
    return apiError(res, 422, 'INVALID_STATUS', 'حالة غير صالحة', 'status');
  }
  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
  logAction(actorFrom(req), 'report_resolve', 'report', id, reason, { status });
  res.json({ ok: true, reportId: id, status });
});

// GET /admin/users
router.get('/users', permissionRequired('users','search'), (req, res) => {
  const rows = db.prepare(
    `SELECT id, name, phone, gender, status, role, created_at
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY id DESC LIMIT 200`
  ).all();
  res.json({ users: rows });
});

// GET /admin/users/:id
router.get('/users/:id', permissionRequired('users','search'), (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare(
    `SELECT id, name, phone, gender, status, role, created_at FROM users WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
  if (!user) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  const reports = db.prepare('SELECT COUNT(*) AS c FROM reports WHERE reported_id = ?').get(id).c;
  const trust = db.prepare('SELECT trust_level FROM users WHERE id = ?').get(id);
  res.json({ user, reportsAgainst: reports, trustLevel: trust?.trust_level || null });
});

// POST /admin/users/:id/suspend { reason }
router.post('/users/:id/suspend', permissionRequired('users','restrict'), (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  if (!reason) return apiError(res, 422, 'REASON_REQUIRED', 'سبب الإيقاف مطلوب', 'reason');
  db.prepare("UPDATE users SET status = 'suspended' WHERE id = ? AND deleted_at IS NULL").run(id);
  logAction(actorFrom(req), 'user_suspend', 'user', id, reason);
  res.json({ ok: true, userId: id, status: 'suspended' });
});

// POST /admin/users/:id/unsuspend { reason }
router.post('/users/:id/unsuspend', permissionRequired('users','restrict'), (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  db.prepare("UPDATE users SET status = 'active' WHERE id = ? AND deleted_at IS NULL").run(id);
  logAction(actorFrom(req), 'user_unsuspend', 'user', id, reason);
  res.json({ ok: true, userId: id, status: 'active' });
});

// POST /admin/users/:id/role { role, reason }
router.post('/users/:id/role', permissionRequired('roles','manage'), (req, res) => {
  const id = Number(req.params.id);
  const { role, reason } = req.body || {};
  const allowed = ['user', 'viewer', 'moderator', 'verification_officer', 'customer_support', 'rule_admin', 'subscription_admin', 'admin', 'super_admin'];
  if (!allowed.includes(role)) return apiError(res, 422, 'INVALID_ROLE', 'دور غير صالح', 'role');
  const ctx = req.adminContext;
  if (!ctx || ctx.role !== 'super_admin') {
    return apiError(res, 403, 'SUPER_ADMIN_REQUIRED', 'تغيير الأدوار يتطلب super_admin');
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL').run(role, id);
  logAction(actorFrom(req), 'user_role_change', 'user', id, reason, { role });
  res.json({ ok: true, userId: id, role });
});

// GET /admin/plans
router.get('/plans', permissionRequired('dashboard','view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM plans ORDER BY price_egp').all();
  res.json({ plans: rows.map((p) => ({ ...p, features: JSON.parse(p.features || '[]') })) });
});

// PATCH /admin/plans/:code { name, priceEgp, regularPriceEgp, status, features }
router.patch('/plans/:code', permissionRequired('plans','manage'), (req, res) => {
  const code = req.params.code;
  const { name, priceEgp, regularPriceEgp, status, features } = req.body || {};
  const current = db.prepare('SELECT * FROM plans WHERE code = ?').get(code);
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
  db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE code = ?`).run(...params);
  logAction(actorFrom(req), 'plan_update', 'plan', code, null, req.body);
  res.json({ ok: true, planCode: code });
});

// GET /admin/payments
router.get('/payments', permissionRequired('audit','view'), (req, res) => {
  const rows = db.prepare(
    `SELECT p.id, p.user_id, u.name AS user_name, p.subscription_id, p.amount_egp, p.provider, p.status, p.created_at
     FROM payments p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.id DESC LIMIT 200`
  ).all();
  res.json({ payments: rows });
});

// GET /admin/subscriptions
router.get('/subscriptions', permissionRequired('audit','view'), (req, res) => {
  const rows = db.prepare(
    `SELECT s.*, u.name AS user_name, p.name AS plan_name
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     JOIN plans p ON p.code = s.plan_code
     ORDER BY s.id DESC LIMIT 200`
  ).all();
  res.json({ subscriptions: rows });
});

// GET /admin/audit-log
router.get('/audit-log', permissionRequired('audit','view'), (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM admin_actions ORDER BY id DESC LIMIT 200'
  ).all();
  res.json({ actions: rows });
});

// GET /admin/matching/weights
router.get('/matching/weights', permissionRequired('dashboard','view'), (req, res) => {
  res.json(listWeights());
});

// POST /admin/matching/weights { weights }
router.post('/matching/weights', permissionRequired('config','manage'), (req, res) => {
  const { weights } = req.body || {};
  if (!weights || typeof weights !== 'object') return apiError(res, 422, 'INVALID_WEIGHTS', 'أوزان غير صالحة', 'weights');
  saveWeights(weights);
  logAction(actorFrom(req), 'matching_weights_update', 'config', 'match_weights', null, weights);
  res.json({ ok: true });
});

// POST /admin/matching/threshold { threshold }
router.post('/matching/threshold', permissionRequired('config','manage'), (req, res) => {
  const threshold = Number((req.body || {}).threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    return apiError(res, 422, 'INVALID_THRESHOLD', 'عتبة غير صالحة', 'threshold');
  }
  saveThreshold(threshold);
  logAction(actorFrom(req), 'matching_threshold_update', 'config', 'match_threshold', null, { threshold });
  res.json({ ok: true, threshold });
});

// GET /admin/moderation?status=pending&limit=200
router.get('/moderation', permissionRequired('queues','view'), (req, res) => {
  const status = req.query.status || 'pending';
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const rows = getQueue(status, limit).map((it) => ({
    ...it,
    violations: JSON.parse(it.violations || '[]'),
    originalText: maskedText(it.original_text),
  }));
  res.json({ items: rows });
});

// POST /admin/moderation/:id/resolve { action: 'approve'|'reject'|'overturn', reason }
router.post('/moderation/:id/resolve', adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!['approve', 'reject', 'overturn'].includes(action)) {
    return apiError(res, 422, 'INVALID_ACTION', 'إجراء غير صالح', 'action');
  }
  const item = itemById(id);
  if (!item) return apiError(res, 404, 'ITEM_NOT_FOUND', 'العنصر غير موجود');
  const ctx = actorFrom(req);
  const requiredPerm = action === 'overturn' ? 'content.override' : 'content.review';
  const [resource, act] = requiredPerm.split('.');
  if (!hasPermission(ctx.role, resource, act)) {
    return apiError(res, 403, 'ADMIN_REQUIRED', `يتطلب صلاحية ${requiredPerm}`);
  }
  const result = resolveItem(id, action, ctx.userId || null, ctx.role, reason);
  logAction(ctx, 'moderation_' + action, 'moderation_item', id, reason, { status: result.status });
  res.json({ ok: true, itemId: id, status: result.status });
});

// GET /admin/photos?status=pending — avatar review queue
router.get('/photos', permissionRequired('queues','view'), (req, res) => {
  const status = req.query.status || 'pending';
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const rows = getPendingPhotos(status, limit).map((p) => ({
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
});

// POST /admin/photos/:id/decision { action: 'approve'|'reject', reason }
router.post('/photos/:id/decision', adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return apiError(res, 422, 'INVALID_ACTION', 'إجراء غير صالح', 'action');
  }
  const ctx = actorFrom(req);
  const result = action === 'approve' ? approvePhoto(id, ctx.userId || null) : rejectPhoto(id, ctx.userId || null, reason);
  if (!result.ok) return apiError(res, 404, 'PHOTO_NOT_PENDING', 'الصورة غير موجودة أو ليست بانتظار المراجعة');
  await notify(result.userId, 'system', action === 'approve' ? 'تمت الموافقة على صورتك الرمزية ✓' : 'عُرضت صورتك الرمزية عن المراجعة — أعد رفع صورة أخرى');
  logAction(ctx, 'photo_' + action, 'user_photo', id, reason, { status: action });
  res.json({ ok: true, photoId: id, status: action });
});

// GET /admin/events?type=&entityType=&entityId=&limit=
router.get('/events', permissionRequired('queues','view'), (req, res) => {
  const events = listEvents({
    type: req.query.type,
    entityType: req.query.entityType,
    entityId: req.query.entityId,
    limit: Number(req.query.limit) || 100,
  });
  res.json({ events });
});

// POST /admin/events/publish { type, payload, userId, entityType, entityId }
router.post('/events/publish', permissionRequired('config','manage'), (req, res) => {
  const { type, payload, userId, entityType, entityId } = req.body || {};
  if (!type) return apiError(res, 422, 'MISSING_TYPE', 'نوع الحدث مطلوب', 'type');
  const id = publish(type, payload || {}, 'admin', { userId, entityType, entityId });
  logAction(actorFrom(req), 'event_publish', 'event', id, null, { type });
  res.status(201).json({ eventId: id });
});

// GET /admin/workflows
router.get('/workflows', permissionRequired('dashboard','view'), (req, res) => {
  res.json({ definitions: listDefinitions(), instances: listInstances({ limit: Number(req.query.limit) || 100 }) });
});

// POST /admin/workflows { key, version, name, states, transitions }
router.post('/workflows', permissionRequired('workflows','manage'), (req, res) => {
  const { key, version, name, states, transitions } = req.body || {};
  if (!key || !name || !Array.isArray(states) || !Array.isArray(transitions)) {
    return apiError(res, 422, 'INVALID_DEFINITION', 'تعريف workflow غير صالح');
  }
  const id = createDefinition({ key, version: Number(version) || 1, name, states, transitions, status: 'published' });
  logAction(actorFrom(req), 'workflow_create', 'workflow', id, null, { key, version });
  res.status(201).json({ id });
});

// POST /admin/workflows/:id/instances { entityType, entityId, context }
router.post('/workflows/:id/instances', permissionRequired('workflows','manage'), (req, res) => {
  const defId = Number(req.params.id);
  const def = getInstance(defId);
  if (!def) return apiError(res, 404, 'DEFINITION_NOT_FOUND', 'تعريف workflow غير موجود');
  const { entityType, entityId, context } = req.body || {};
  if (!entityType || !entityId) return apiError(res, 422, 'MISSING_ENTITY', 'الكيان مطلوب');
  const result = startInstance(def.key, entityType, entityId, context || {});
  res.status(201).json(result);
});

// POST /admin/workflows/instances/:id/transition { toState, reason }
router.post('/workflows/instances/:id/transition', permissionRequired('workflows','manage'), (req, res) => {
  const id = Number(req.params.id);
  const { toState, reason } = req.body || {};
  if (!toState) return apiError(res, 422, 'MISSING_STATE', 'الحالة المستهدفة مطلوبة');
  const ctx = actorFrom(req);
  const result = transition(id, toState, { actorId: ctx.userId || null, actorRole: ctx.role, reason });
  logAction(ctx, 'workflow_transition', 'workflow_instance', id, reason, { toState });
  res.json(result);
});

// GET /admin/rules
router.get('/rules', permissionRequired('dashboard','view'), (req, res) => {
  res.json({ rules: listRules({ eventType: req.query.eventType, status: req.query.status }) });
});

// POST /admin/rules { name, description, eventType, conditions, actions, priority, status, userMessage, sensitive }
router.post('/rules', permissionRequired('rules','manage'), (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.eventType || !Array.isArray(body.conditions) || !Array.isArray(body.actions)) {
    return apiError(res, 422, 'INVALID_RULE', 'قاعدة غير صالحة');
  }
  const id = createRule({
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
  logAction(actorFrom(req), 'rule_create', 'rule', id, null, { name: body.name, eventType: body.eventType });
  res.status(201).json({ id });
});

// POST /admin/rules/:id/enable or /disable
router.post('/rules/:id/toggle', permissionRequired('rules','manage'), (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  updateRule(id, { status: active ? 'active' : 'inactive' });
  logAction(actorFrom(req), active ? 'rule_enable' : 'rule_disable', 'rule', id);
  res.json({ ok: true, id, status: active ? 'active' : 'inactive' });
});

// POST /admin/rules/:id/test { context }
router.post('/rules/:id/test', permissionRequired('rules','manage'), (req, res) => {
  const id = Number(req.params.id);
  const result = testRule(id, req.body?.context || {});
  if (!result) return apiError(res, 404, 'RULE_NOT_FOUND', 'القاعدة غير موجودة');
  res.json({ result });
});

// GET /admin/recommendations/config
router.get('/recommendations/config', permissionRequired('dashboard','view'), (req, res) => {
  res.json({ config: listConfig() });
});

// POST /admin/recommendations/config { config }
router.post('/recommendations/config', permissionRequired('config','manage'), (req, res) => {
  const { config } = req.body || {};
  if (!config || typeof config !== 'object') return apiError(res, 422, 'INVALID_CONFIG', 'إعدادات غير صالحة', 'config');
  saveConfig(config);
  logAction(actorFrom(req), 'recommendation_config_update', 'config', 'recommendation_config', null, config);
  res.json({ ok: true, config: listConfig() });
});

export default router;
