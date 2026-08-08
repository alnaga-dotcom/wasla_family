const BASE = 'http://127.0.0.1:4000';
const crypto = await import('node:crypto');

function freshPhone() {
  return '01' + String(crypto.randomInt(100000000, 999999999));
}

async function call(path, method, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function newUser(name, phone) {
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender: 'male', email });
  let code;
  if (reg.ok) code = reg.data.dev.otp;
  else if (reg.data.code === 'ALREADY_REGISTERED') {
    const login = await call('/api/auth/login', 'POST', { phone });
    code = login.data.dev.otp;
  } else throw new Error('register failed: ' + JSON.stringify(reg.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code });
  if (!ver.ok) throw new Error('otp failed: ' + JSON.stringify(ver.data));
  return ver.data;
}

async function patch(token, field_key, value) {
  const r = await call('/api/profile/me', 'PATCH', { field_key, value }, token);
  if (!r.ok) throw new Error(`patch ${field_key} failed: ` + JSON.stringify(r.data));
  return r.data;
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const p1 = freshPhone(), p2 = freshPhone();
const u1 = await newUser('أحمد', p1);
const u2 = await newUser('كريم', p2);
assert(true, `registered u1=${u1.user.id} u2=${u2.user.id}`);

await patch(u1.token, 'birth_year', '1996');
await patch(u1.token, 'city', 'القاهرة');
await patch(u1.token, 'profession', 'هندسة');
await patch(u1.token, 'education', 'بكالوريوس');
await patch(u1.token, 'religiosity', 'ملتزم');
await patch(u1.token, 'lifestyle', 'هادئ');
const compFinal = await patch(u1.token, 'photo_done', 1);
assert(compFinal.completion.pct >= 40, `u1 completion=${compFinal.completion.pct}%`);

// u2 gets a profile so it ranks in the feed regardless of accumulated test users
await patch(u2.token, 'birth_year', '1995');
await patch(u2.token, 'city', 'القاهرة');
await patch(u2.token, 'profession', 'هندسة');
await patch(u2.token, 'education', 'بكالوريوس');
await patch(u2.token, 'religiosity', 'ملتزم');
await patch(u2.token, 'lifestyle', 'هادئ');
await patch(u2.token, 'photo_done', 1);
await patch(u2.token, 'selfie_done', 1);

// u1 discovery should include u2 (request up to 50 to outpace accumulated test users)
const disc1 = await call('/api/discovery/recommendations?limit=50', 'GET', null, u1.token);
const found2 = disc1.data.recommendations.some((c) => c.userId === u2.user.id);
assert(disc1.ok && found2, 'u1 discovery includes u2 with completion=' + (disc1.data.recommendations.find((c) => c.userId === u2.user.id) || {}).completion);

// mutual like
const likeFrom2 = await call(`/api/matches/${u1.user.id}/like`, 'POST', { like: true }, u2.token);
assert(likeFrom2.ok && likeFrom2.data.mutual === false, 'u2->u1 like, mutual=false');
const likeFrom1 = await call(`/api/matches/${u2.user.id}/like`, 'POST', { like: true }, u1.token);
assert(likeFrom1.ok && likeFrom1.data.mutual === true, 'u1->u2 like, mutual=true');

const mutuals1 = await call('/api/matches/mutual', 'GET', null, u1.token);
const mutuals2 = await call('/api/matches/mutual', 'GET', null, u2.token);
assert(mutuals1.data.matches.some((m) => m.userId === u2.user.id), 'u1 sees u2 in mutuals');
assert(mutuals2.data.matches.some((m) => m.userId === u1.user.id), 'u2 sees u1 in mutuals');

// seen + archive
await call('/api/discovery/recommendations/seen', 'POST', { userId: u2.user.id }, u1.token);
const discAfter = await call('/api/discovery/recommendations', 'GET', null, u1.token);
assert(!discAfter.data.recommendations.some((c) => c.userId === u2.user.id), 'u2 excluded after seen/viewed');
const arch = await call(`/api/matches/${u2.user.id}/archive`, 'POST', {}, u1.token);
assert(arch.ok, 'archive ok');
const mutualsAfter = await call('/api/matches/mutual', 'GET', null, u1.token);
assert(!mutualsAfter.data.matches.some((m) => m.userId === u2.user.id), 'u1 mutuals no longer lists archived u2');

console.log('ALL PASSED');
