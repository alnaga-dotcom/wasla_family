const BASE = 'http://127.0.0.1:4000';
const crypto = await import('node:crypto');

async function call(path, method, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function newUser(name, gender) {
  const phone = '01' + String(crypto.randomInt(100000000, 999999999));
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender });
  if (!reg.ok) throw new Error('register failed: ' + JSON.stringify(reg.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  return { token: ver.data.token, id: ver.data.user.id };
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const a = await newUser('مرمر', 'female');
const b = await newUser('منار', 'female');

// give A a full profile so it ranks at the top of B's feed regardless of accumulated test users
// give B a few shared fields so match score from B→A passes the threshold
for (const [k, v] of [['city', 'القاهرة'], ['religiosity', 'ملتزم'], ['selfie_done', '1']]) {
  await call('/api/profile/me', 'PATCH', { field_key: k, value: v }, b.token);
}

for (const [k, v] of [['age', '26'], ['city', 'القاهرة'], ['profession', 'تعليم'], ['education', 'بكالوريوس'], ['religiosity', 'ملتزم'], ['lifestyle', 'هادئ'], ['photo_done', '1'], ['selfie_done', '1']]) {
  await call('/api/profile/me', 'PATCH', { field_key: k, value: v }, a.token);
}

// defaults
const dflt = await call('/api/settings', 'GET', null, a.token);
assert(dflt.ok && dflt.data.settings.photo_visibility === 0 && dflt.data.settings.paused === 0, 'defaults: photo_visibility=0 paused=0');

// persist updates
const upd = await call('/api/settings', 'PATCH', { photo_visibility: 2, last_seen_on: false, paused: true }, a.token);
assert(upd.ok && upd.data.settings.photo_visibility === 2 && upd.data.settings.paused === 1, 'PATCH persists paused + photo_visibility=2');
const reread = await call('/api/settings', 'GET', null, a.token);
assert(reread.data.settings.photo_visibility === 2 && reread.data.settings.paused === 1, 'values persist after re-read');

// validation: bad photo_visibility
const bad = await call('/api/settings', 'PATCH', { photo_visibility: 9 }, a.token);
assert(bad.status === 422, 'photo_visibility=9 rejected (422)');

// paused member disappears from B's discovery + search
const disc = await call('/api/discovery/recommendations?limit=50', 'GET', null, b.token);
assert(!disc.data.recommendations.some((c) => c.userId === a.id), 'paused member excluded from discovery');
const search = await call('/api/search?limit=50', 'GET', null, b.token);
assert(!search.data.items.some((c) => c.userId === a.id), 'paused member excluded from search');

// unpause → reappears
await call('/api/settings', 'PATCH', { paused: false }, a.token);
const disc2 = await call('/api/discovery/recommendations?limit=50', 'GET', null, b.token);
assert(disc2.data.recommendations.some((c) => c.userId === a.id), 'after unpause, member reappears in discovery');

console.log('ALL PASSED');
