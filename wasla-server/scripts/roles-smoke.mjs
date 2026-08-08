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

async function makeRole(role) {
  const user = await newUser('R_' + role, '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
  const ch = await call(`/admin/users/${user.user.id}/role`, 'POST', { role, reason: 'test' }, null, ADMIN_KEY);
  assert(ch.ok, `super_admin can assign ${role}`);
  return user;
}

const viewer = await makeRole('viewer');
const moderator = await makeRole('moderator');
const vofficer = await makeRole('verification_officer');
const support = await makeRole('customer_support');
const ruleAdmin = await makeRole('rule_admin');
const subAdmin = await makeRole('subscription_admin');
const admin = await makeRole('admin');

// Regular user is rejected
const reg = await call('/admin/dashboard', 'GET', null, (await newUser('عادي', '010' + String(Math.floor(10000000 + Math.random() * 89999999)))).token);
assert(reg.status === 403, 'regular user rejected from admin');

// Viewer can view dashboard and reports but cannot suspend
const vDash = await call('/admin/dashboard', 'GET', null, viewer.token);
assert(vDash.ok, 'viewer sees dashboard');
const vReports = await call('/admin/reports', 'GET', null, viewer.token);
assert(vReports.ok, 'viewer sees reports queue');
const vUsers = await call('/admin/users', 'GET', null, viewer.token);
assert(vUsers.status === 403, 'viewer cannot search users');

// Moderator can review moderation queue and resolve (but not override)
const modQueue = await call('/admin/moderation', 'GET', null, moderator.token);
assert(modQueue.ok, 'moderator sees moderation queue');

// Support can search users
const sUsers = await call('/admin/users', 'GET', null, support.token);
assert(sUsers.ok, 'support searches users');
const sDash = await call('/admin/dashboard', 'GET', null, support.token);
assert(sDash.ok, 'support sees dashboard');
const sModeration = await call('/admin/moderation', 'GET', null, support.token);
assert(sModeration.ok, 'support can view moderation queue');

// Subscription admin can manage plans
const pDash = await call('/admin/plans', 'GET', null, subAdmin.token);
assert(pDash.ok, 'subscription admin sees plans');
const pPatch = await call('/admin/plans/monthly', 'PATCH', { priceEgp: 280 }, subAdmin.token);
assert(pPatch.ok, 'subscription admin updates plans');

// Admin can do most things except roles (role change to admin still blocked)
const adDash = await call('/admin/dashboard', 'GET', null, admin.token);
assert(adDash.ok, 'admin sees dashboard');
const adRole = await call(`/admin/users/${viewer.user.id}/role`, 'POST', { role: 'admin', reason: 'test' }, null, admin.token);
assert(adRole.status === 403, 'admin cannot change roles');

// Role list endpoint
const roles = await call('/admin/roles', 'GET', null, null, ADMIN_KEY);
assert(roles.ok && roles.data.roles.length >= 8, 'roles endpoint lists matrix');
const perms = await call('/admin/permissions', 'GET', null, null, ADMIN_KEY);
assert(perms.ok && perms.data.permissions.length > 20, 'permissions matrix present');

console.log('ALL ROLES/PERMISSIONS TESTS PASSED');
