const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:4000';
const ADMIN_KEY = 'dev-admin-key-change-me';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function apiCall(path, method = 'GET', body = null, token = null, useAdminKey = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (useAdminKey) headers['X-Admin-Key'] = ADMIN_KEY;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function register(role = 'user') {
  const phone = '010' + String(Math.floor(10000000 + Math.random() * 89999999));
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await apiCall('/api/auth/register', 'POST', { name: 'AdminTester', gender: 'male', phone, email });
  const ver = await apiCall('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  if (role !== 'user') {
    await apiCall(`/admin/users/${ver.data.user.id}/role`, 'POST', { role, reason: 'test' }, null, true);
  }
  return ver.data;
}

const regular = await register('user');
assert(regular.user.role === 'user', 'regular user registered');

const admin = await register('admin');
const adminMe = await apiCall('/api/auth/me', 'GET', null, admin.token);
assert(adminMe.data.user.role === 'admin', 'admin user role updated');

// Admin can access dashboard
const dash = await apiCall('/admin/dashboard', 'GET', null, admin.token);
assert(dash.ok, 'admin dashboard reachable with staff token');

// Regular user cannot access admin dashboard
const noDash = await apiCall('/admin/dashboard', 'GET', null, regular.token);
assert(noDash.status === 403, 'regular user blocked from admin dashboard');

// App index includes admin navigation and app.js includes admin renderer
const html = await (await fetch(BASE + '/')).text();
assert(html.includes('nav-admin'), 'app includes admin navigation');
const appJs = await (await fetch(BASE + '/app.js')).text();
assert(appJs.includes('renderAdmin'), 'app.js includes admin renderer');
assert(appJs.includes('renderAdminVerification'), 'app.js includes verification tab renderer');
assert(appJs.includes('renderAdminSubscriptions'), 'app.js includes subscriptions tab renderer');
assert(appJs.includes('data-admin="verification"'), 'app.js nav includes verification tab');

console.log('ALL ADMIN PANEL TESTS PASSED');
