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

async function patch(token, key, value) {
  const r = await call('/api/profile/me', 'PATCH', { field_key: key, value }, token);
  if (!r.ok) throw new Error('patch ' + key + ' failed: ' + JSON.stringify(r.data));
}

const me = await newUser('محمود', 'male');
const tName = 'طارق-' + crypto.randomInt(1000, 9999);
const t = await newUser(tName, 'male');
await patch(t.token, 'city', 'القاهرة');
await patch(t.token, 'education', 'بكالوريوس');
await patch(t.token, 'religiosity', 'ملتزم');
await patch(t.token, 'profession', 'هندسة');
await patch(t.token, 'lifestyle', 'هادئ');
await patch(t.token, 'age', '28');
await patch(t.token, 'selfie_done', '1');
await patch(me.token, 'city', 'القاهرة');
await patch(me.token, 'education', 'بكالوريوس');
await patch(me.token, 'selfie_done', '1');

// filters endpoint
const filters = await call('/api/search/filters', 'GET', null, me.token);
assert(filters.ok && filters.data.filters.city && filters.data.filters.education, 'search/filters returns searchable options');
assert(!filters.data.filters.health, 'health is NOT searchable');

// find tarek by unique name
const byName = await call('/api/search?q=' + encodeURIComponent(tName), 'GET', null, me.token);
assert(byName.data.items.some((c) => c.userId === t.id), 'search by name finds Tarek');
const card = byName.data.items.find((c) => c.userId === t.id);
assert(card.phone === undefined && card.health === undefined, 'search card excludes contact + sensitive fields');

// filter by city
const byCity = await call('/api/search?city=' + encodeURIComponent('القاهرة'), 'GET', null, me.token);
assert(byCity.data.items.some((c) => c.userId === t.id), 'search by city finds Tarek');

// filter mismatch → empty
const noHit = await call('/api/search?city=' + encodeURIComponent('المنصورة'), 'GET', null, me.token);
assert(noHit.data.items.every((c) => c.userId !== t.id), 'mismatched city excludes Tarek');

// new filters: profession, religiosity, lifestyle, age range
const byProf = await call('/api/search?profession=' + encodeURIComponent('هندسة'), 'GET', null, me.token);
assert(byProf.data.items.some((c) => c.userId === t.id), 'filter by profession finds Tarek');
const byRel = await call('/api/search?religiosity=' + encodeURIComponent('ملتزم'), 'GET', null, me.token);
assert(byRel.data.items.some((c) => c.userId === t.id), 'filter by religiosity finds Tarek');
const byLife = await call('/api/search?lifestyle=' + encodeURIComponent('هادئ'), 'GET', null, me.token);
assert(byLife.data.items.some((c) => c.userId === t.id), 'filter by lifestyle finds Tarek');
const byAge = await call('/api/search?ageMin=25&ageMax=30', 'GET', null, me.token);
assert(byAge.data.items.some((c) => c.userId === t.id), 'filter by age range (25-30) finds Tarek (28)');
const byAgeMiss = await call('/api/search?ageMin=40&ageMax=50', 'GET', null, me.token);
assert(byAgeMiss.data.items.every((c) => c.userId !== t.id), 'age range (40-50) excludes Tarek (28)');
const filters2 = await call('/api/search/filters', 'GET', null, me.token);
assert(!!filters2.data.filters.profession, 'profession offered as searchable filter');

// mutual pair reasons
await call('/api/matches/' + t.id + '/like', 'POST', { like: true }, me.token);
await call('/api/matches/' + me.id + '/like', 'POST', { like: true }, t.token);
const reasons = await call('/api/matches/' + t.id + '/reasons', 'GET', null, me.token);
assert(reasons.ok && reasons.data.reasons.includes('نفس المدينة'), 'match reasons computed from shared fields');

// reasons blocked for non-mutual
const stranger = await newUser('غريب', 'male');
const reasonsBlocked = await call('/api/matches/' + stranger.id + '/reasons', 'GET', null, me.token);
assert(reasonsBlocked.status === 403, 'reasons require mutual match (403)');

console.log('ALL PASSED');
