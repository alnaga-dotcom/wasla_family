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
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender });
  if (reg.ok) return (await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp })).data;
  if (reg.data.code === 'ALREADY_REGISTERED') {
    const login = await call('/api/auth/login', 'POST', { phone });
    return (await call('/api/auth/otp/verify', 'POST', { phone, code: login.data.dev.otp })).data;
  }
  throw new Error('register failed: ' + JSON.stringify(reg.data));
}

async function setProfile(token, fields) {
  for (const [key, value] of Object.entries(fields)) {
    const r = await call('/api/profile/me', 'PATCH', { field_key: key, value }, token);
    if (!r.ok) throw new Error('profile update failed: ' + key + ' ' + JSON.stringify(r.data));
  }
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

// Create two users with many shared fields
const a = await newUser('عمرو', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
const b = await newUser('مريم', '010' + String(Math.floor(10000000 + Math.random() * 89999999)), 'female');

const shared = {
  age: 30, city: 'القاهرة', nationality: 'مصري', profession: 'تقنية', education: 'بكالوريوس',
  religiosity: 'ملتزم', lifestyle: 'هادئ', height: 170, selfie_done: 1, photo_done: 1,
};
await setProfile(a.token, shared);
await setProfile(b.token, shared);

// A score for B should be high (same city, nationality, education, religiosity, lifestyle, age, height)
const score = await call(`/api/matches/${b.user.id}/score`, 'GET', null, a.token);
assert(score.ok && score.data.score >= 80, 'high score for very compatible pair: ' + score.data.score);
assert(score.data.level === 'high', 'score level high');
assert(score.data.reasons.includes('نفس المدينة'), 'reason includes same city');

// C with different fields
const c = await newUser('سارة', '010' + String(Math.floor(10000000 + Math.random() * 89999999)), 'female');
await setProfile(c.token, {
  age: 45, city: 'الإسكندرية', nationality: 'سعودي', profession: 'طب', education: 'دكتوراه',
  religiosity: 'مرن', lifestyle: 'اجتماعي', height: 160, selfie_done: 1, photo_done: 1,
});

const scoreLow = await call(`/api/matches/${c.user.id}/score`, 'GET', null, a.token);
assert(scoreLow.ok && scoreLow.data.score < 60, 'low score for mismatched pair: ' + scoreLow.data.score);
assert(scoreLow.data.level === 'low', 'score level low');

// Mutual match: A and B like each other
await call(`/api/matches/${b.user.id}/like`, 'POST', { like: true }, a.token);
await call(`/api/matches/${a.user.id}/like`, 'POST', { like: true }, b.token);

const mutuals = await call('/api/matches/mutual', 'GET', null, a.token);
const m = mutuals.data.matches.find((x) => x.userId === b.user.id);
assert(m && m.matchScore >= 80, 'mutual match includes score');
assert(m.matchLevel === 'high', 'mutual match level high');

// Admin can update weights and threshold
const weights = await call('/admin/matching/weights', 'GET', null, null, ADMIN_KEY);
assert(weights.ok && weights.data.weights.city, 'admin sees current weights');

const update = await call('/admin/matching/weights', 'POST', { weights: { ...weights.data.weights, city: 50 } }, null, ADMIN_KEY);
assert(update.ok, 'admin updates weights');

const thresholdUpdate = await call('/admin/matching/threshold', 'POST', { threshold: 70 }, null, ADMIN_KEY);
assert(thresholdUpdate.ok && thresholdUpdate.data.threshold === 70, 'admin updates threshold');

// Discovery should filter by threshold
const discovery = await call('/api/discovery/recommendations?limit=10', 'GET', null, a.token);
assert(discovery.ok, 'discovery returns');
// All recommendations should be >= 70 (new threshold) or empty if none
for (const rec of discovery.data.recommendations) {
  assert(rec.matchScore >= 70, 'discovery respects threshold');
}

// Restore threshold
await call('/admin/matching/threshold', 'POST', { threshold: 60 }, null, ADMIN_KEY);

console.log('ALL MATCHING ENGINE TESTS PASSED');
