const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function apiCall(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function register() {
  const phone = '010' + String(Math.floor(10000000 + Math.random() * 89999999));
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await apiCall('/api/auth/register', 'POST', { name: 'NotifTester', gender: 'female', phone, email });
  const ver = await apiCall('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  return ver.data;
}

const html = await (await fetch(BASE + '/')).text();
assert(html.includes('data-page="notifications"'), 'app has notifications tab');
assert(html.includes('notif-badge'), 'app has notifications badge');

const appJs = await (await fetch(BASE + '/app.js')).text();
assert(appJs.includes('renderNotifications'), 'app.js includes notifications renderer');
assert(appJs.includes('updateBadge'), 'app.js includes badge updater');

const user = await register();
const notifs = await apiCall('/api/notifications', 'GET', null, user.token);
assert(notifs.ok && Array.isArray(notifs.data.notifications), 'notifications API works');

console.log('ALL NOTIFICATIONS UI TESTS PASSED');
