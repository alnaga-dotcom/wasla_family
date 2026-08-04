const BASE = 'http://127.0.0.1:8081';
const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const paths = ['/', '/app.js', '/style.css', '/manifest.json', '/sw.js', '/icon.svg', '/config.json'];
for (const p of paths) {
  const r = await fetch(BASE + p);
  assert(r.status === 200, `serves ${p}`);
}

const html = await fetch(BASE + '/').then((r) => r.text());
assert(html.includes('app.js') && html.includes('manifest.json'), 'index.html references app and manifest');

const cfg = await fetch(BASE + '/config.json').then((r) => r.json());
assert(cfg.apiBase === API, 'config.json points to local API by default');

// Register via API and load profile through app-referenced API (sanity)
const phone = '010' + String(Math.floor(10000000 + Math.random() * 89999999));
const reg = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'AppTester', gender: 'male', phone }) });
const regData = await reg.json();
assert(reg.ok && regData.dev?.otp, 'server registration works for app flow');

const verify = await fetch(API + '/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code: regData.dev.otp }) });
const vData = await verify.json();
assert(verify.ok && vData.token, 'server OTP verification works for app flow');

const me = await fetch(API + '/api/profile/me', { headers: { Authorization: 'Bearer ' + vData.token } });
assert(me.ok, 'app will be able to load profile');

console.log('ALL APP SMOKE TESTS PASSED');
