const BASE = 'http://127.0.0.1:4000';
const ADMIN_KEY = 'dev-admin-key-change-me';

async function call(path, method, body, token, adminKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function newUser(name, phone, gender = 'male') {
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender, email });
  if (reg.ok) return (await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp })).data;
  if (reg.data.code === 'ALREADY_REGISTERED') {
    const login = await call('/api/auth/login', 'POST', { phone });
    return (await call('/api/auth/otp/verify', 'POST', { phone, code: login.data.dev.otp })).data;
  }
  throw new Error('register failed: ' + JSON.stringify(reg.data));
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

// Create regular user and a report target
const reporter = await newUser('شاكي', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
const target = await newUser('مشكوك', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
await call(`/api/report/${target.user.id}`, 'POST', { reason: 'سلوك غير لائق' }, reporter.token);

// Non-admin is rejected
const dashNoAuth = await call('/admin/dashboard', 'GET');
assert(dashNoAuth.status === 403, 'admin endpoint rejects missing auth');

// Admin key works
const dash = await call('/admin/dashboard', 'GET', null, null, ADMIN_KEY);
assert(dash.ok && typeof dash.data.users === 'number', 'admin dashboard returns counts');

// Reports list contains our report
const reports = await call('/admin/reports', 'GET', null, null, ADMIN_KEY);
assert(reports.ok && reports.data.reports.some((r) => r.reported_id === target.user.id), 'admin sees report');

const reportId = reports.data.reports.find((r) => r.reported_id === target.user.id).id;
const resolved = await call(`/admin/reports/${reportId}/resolve`, 'POST', { status: 'resolved', reason: 'تم التحقق' }, null, ADMIN_KEY);
assert(resolved.ok && resolved.data.status === 'resolved', 'report resolved');

// Users list contains target
const users = await call('/admin/users', 'GET', null, null, ADMIN_KEY);
assert(users.ok && users.data.users.some((u) => u.id === target.user.id), 'admin sees users');

// Suspend target
const suspend = await call(`/admin/users/${target.user.id}/suspend`, 'POST', { reason: 'انتهاك السياسة' }, null, ADMIN_KEY);
assert(suspend.ok && suspend.data.status === 'suspended', 'user suspended');

// Suspended user cannot use auth-required endpoints
const me = await call('/api/auth/me', 'GET', null, target.token);
assert(me.status === 403, 'suspended user blocked');

// Unsuspend target
const unsuspend = await call(`/admin/users/${target.user.id}/unsuspend`, 'POST', { reason: 'تم الاستئناف' }, null, ADMIN_KEY);
assert(unsuspend.ok && unsuspend.data.status === 'active', 'user unsuspended');

// Plans update
const planPatch = await call('/admin/plans/monthly', 'PATCH', { priceEgp: 250, regularPriceEgp: 500 }, null, ADMIN_KEY);
assert(planPatch.ok, 'admin updates plan price');
const plans = await call('/admin/plans', 'GET', null, null, ADMIN_KEY);
const monthly = plans.data.plans.find((p) => p.code === 'monthly');
assert(monthly.price_egp === 250, 'plan price persisted');

// Payments list
const payments = await call('/admin/payments', 'GET', null, null, ADMIN_KEY);
assert(payments.ok, 'admin sees payments');

// Subscriptions list
const subs = await call('/admin/subscriptions', 'GET', null, null, ADMIN_KEY);
assert(subs.ok, 'admin sees subscriptions');

// Audit log captured actions
const audit = await call('/admin/audit-log', 'GET', null, null, ADMIN_KEY);
assert(audit.ok && audit.data.actions.some((a) => a.action === 'user_suspend'), 'audit log records actions');

// Role-based admin access: promote reporter to moderator
const roleChange = await call(`/admin/users/${reporter.user.id}/role`, 'POST', { role: 'moderator', reason: 'اختبار' }, null, ADMIN_KEY);
assert(roleChange.ok, 'role changed to moderator');
const modReports = await call('/admin/reports', 'GET', null, reporter.token);
assert(modReports.ok, 'moderator can access reports via bearer token');

console.log('ALL ADMIN TESTS PASSED');
