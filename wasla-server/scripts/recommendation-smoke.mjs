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

async function patch(token, key, value) {
  const r = await call('/api/profile/me', 'PATCH', { field_key: key, value }, token);
  if (!r.ok) throw new Error('patch ' + key + ' failed: ' + JSON.stringify(r.data));
  return r.data;
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const viewer = await newUser('مكتشف', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
await patch(viewer.token, 'birth_year', '1996');
await patch(viewer.token, 'city', 'القاهرة');
await patch(viewer.token, 'religiosity', 'ملتزم');
await patch(viewer.token, 'selfie_done', '1');

// High-score candidate: same city, age close, selfie, photo, trust L2
const high = await newUser('مرشح ممتاز', '010' + String(Math.floor(10000000 + Math.random() * 89999999)), 'female');
await patch(high.token, 'birth_year', '1997');
await patch(high.token, 'city', 'القاهرة');
await patch(high.token, 'religiosity', 'ملتزم');
await patch(high.token, 'selfie_done', '1');
await patch(high.token, 'photo_done', '1');
await patch(high.token, 'education', 'بكالوريوس');
await patch(high.token, 'lifestyle', 'هادئ');

// Lower-score candidate: same city but older and different religiosity
const low = await newUser('مرشح ضعيف', '010' + String(Math.floor(10000000 + Math.random() * 89999999)), 'female');
await patch(low.token, 'birth_year', '1981');
await patch(low.token, 'city', 'القاهرة');
await patch(low.token, 'religiosity', 'مرن');
await patch(low.token, 'profession', 'طب');
await patch(low.token, 'selfie_done', '1');
await patch(low.token, 'photo_done', '1');

// Give candidates enough fields to score near the top of a populated test DB
await patch(high.token, 'profession', 'تقنية معلومات');
await patch(low.token, 'profession', 'طب');

const disc = await call('/api/discovery/recommendations?limit=500', 'GET', null, viewer.token);
assert(disc.ok && disc.data.recommendations.length >= 2, 'discovery returns recommendations');

const highRec = disc.data.recommendations.find((c) => c.userId === high.user.id);
const lowRec = disc.data.recommendations.find((c) => c.userId === low.user.id);
assert(highRec, 'high candidate appears');
assert(highRec.score > 0, 'high candidate has positive score');
if (lowRec) {
  assert(highRec.score >= lowRec.score, 'high candidate scores at least as high as low candidate');
}
assert(highRec.recommendationReasons.some((r) => r.includes('توافق') || r.includes('موثّق') || r.includes('صورة')), 'high candidate has reasons');

// Admin config update
const cfg = await call('/admin/recommendations/config', 'GET', null, null, ADMIN_KEY);
assert(cfg.ok && cfg.data.config.compatibility_weight !== undefined, 'admin sees recommendation config');

const update = await call('/admin/recommendations/config', 'POST', { config: { compatibility_weight: 0.9, trust_weight: 0.05, freshness_weight: 0.05, photo_weight: 0 } }, null, ADMIN_KEY);
assert(update.ok && update.data.config.compatibility_weight === 0.9, 'admin updates recommendation config');

const disc2 = await call('/api/discovery/recommendations?limit=500', 'GET', null, viewer.token);
assert(disc2.ok && disc2.data.recommendations.length >= 1, 'recommendations still returned after config change');

// Restore defaults
await call('/admin/recommendations/config', 'POST', { config: { compatibility_weight: 0.5, trust_weight: 0.2, freshness_weight: 0.2, photo_weight: 0.1 } }, null, ADMIN_KEY);

console.log('ALL RECOMMENDATION TESTS PASSED');
