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
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender, email });
  if (!reg.ok) throw new Error('register failed: ' + JSON.stringify(reg.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  return { token: ver.data.token, id: ver.data.user.id };
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function patch(token, key, value) {
  const r = await call('/api/profile/me', 'PATCH', { field_key: key, value }, token);
  if (!r.ok) throw new Error('patch ' + key + ' failed: ' + JSON.stringify(r.data));
}

const a = await newUser('ياسمين', 'female');
const b = await newUser('فاطمة', 'female');
await patch(b.token, 'birth_year', '1997');
await patch(b.token, 'city', 'الجيزة');
await patch(b.token, 'profession', 'تعليم');
await patch(b.token, 'education', 'ماجستير');
await patch(b.token, 'selfie_done', 1);

// officer approves verification for B
await call('/api/verification/request', 'POST', { type: 'id' }, b.token);
const adminList = await fetch(BASE + '/api/admin/verification', { headers: { 'X-Admin-Key': 'dev-admin-key-change-me' } }).then((r) => r.json());
const reqId = adminList.requests.find((x) => x.user_id === b.id).id;
await fetch(BASE + '/api/admin/verification/' + reqId + '/decision', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'dev-admin-key-change-me' },
  body: JSON.stringify({ approve: true }),
});

// profile view
const prof = await call('/api/users/' + b.id + '/profile', 'GET', null, a.token);
assert(prof.ok && prof.data.profile.name === 'فاطمة', 'profile view returns safe public fields');
assert(prof.data.profile.health === undefined && prof.data.profile.phone === undefined, 'profile excludes contact + sensitive');
assert(prof.data.profile.isVerified === true && prof.data.profile.education === 'ماجستير', 'profile carries verification + education');
assert(prof.data.viewerLiked === false && prof.data.isFavorite === false, 'initial viewerLiked/isFavorite false');

// favorites add
const fav = await call('/api/favorites/' + b.id, 'POST', {}, a.token);
assert(fav.ok && fav.data.favorite === true, 'add favorite');
const list = await call('/api/favorites', 'GET', null, a.token);
assert(list.data.favorites.some((f) => f.userId === b.id), 'favorites list contains B');

// profile now shows isFavorite
const prof2 = await call('/api/users/' + b.id + '/profile', 'GET', null, a.token);
assert(prof2.data.isFavorite === true, 'profile reflects favorite state');

// remove favorite
const rm = await call('/api/favorites/' + b.id, 'DELETE', {}, a.token);
assert(rm.ok && rm.data.favorite === false, 'remove favorite');
const list2 = await call('/api/favorites', 'GET', null, a.token);
assert(!list2.data.favorites.some((f) => f.userId === b.id), 'favorites list empty after removal');

// like from A → viewerLiked true
await call('/api/matches/' + b.id + '/like', 'POST', { like: true }, a.token);
const prof3 = await call('/api/users/' + b.id + '/profile', 'GET', null, a.token);
assert(prof3.data.viewerLiked === true, 'profile reflects viewer liked state');

// self profile rejected
const self = await call('/api/users/' + a.id + '/profile', 'GET', null, a.token);
assert(self.status === 422, 'viewing own profile rejected (422)');

// blocked profile rejected
const c = await newUser('رانيا', 'female');
await call('/api/block/' + c.id, 'POST', {}, a.token);
const blocked = await call('/api/users/' + c.id + '/profile', 'GET', null, a.token);
assert(blocked.status === 403, 'blocked member profile rejected (403)');

console.log('ALL PASSED');
