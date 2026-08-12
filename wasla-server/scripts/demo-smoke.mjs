const BASE = 'http://127.0.0.1:4000';
const crypto = await import('node:crypto');
const { db } = await import('../src/db.js');

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

async function newUser(name, phone, gender) {
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender, email });
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

async function fullProfile(token) {
  await patch(token, 'birth_year', '1994');
  await patch(token, 'city', 'القاهرة');
  await patch(token, 'profession', 'هندسة');
  await patch(token, 'education', 'بكالوريوس');
  await patch(token, 'religiosity', 'ملتزم');
  await patch(token, 'lifestyle', 'هادئ');
  await patch(token, 'marital_status', 'أعزب');
  await patch(token, 'has_kids', 'لا');
  await patch(token, 'want_kids', 'نعم');
  await patch(token, 'partner_marital_status', 'أعزب/عزباء فقط');
  await patch(token, 'partner_has_kids', 'لا');
  await patch(token, 'partner_want_kids', 'نعم');
  await patch(token, 'marital_done', 1);
  await patch(token, 'selfie_done', 1);
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const pA = freshPhone(), pD1 = freshPhone(), pD2 = freshPhone();
const uA = await newUser('حقيقي أحمد', pA, 'male');
const uD1 = await newUser('ديمو كريم', pD1, 'male');
const uD2 = await newUser('ديمو سارة', pD2, 'female');
assert(true, `registered real uA=${uA.user.id} demo uD1=${uD1.user.id} uD2=${uD2.user.id}`);

// mark the two accounts as demo display accounts directly in the DB
for (const id of [uD1.user.id, uD2.user.id]) {
  await db.prepare('UPDATE users SET is_demo = 1 WHERE id = ?').run(id);
}
await db.close();
assert(true, 'uD1/uD2 flagged is_demo=1');

await fullProfile(uA.token);
await fullProfile(uD1.token);
await fullProfile(uD2.token);

// profile view from a real user shows isDemo
const prof = await call(`/api/users/${uD1.user.id}/profile`, 'GET', null, uA.token);
assert(prof.ok && prof.data.profile.isDemo === true, `profile view exposes isDemo=true for demo user`);

// search from a real user includes the demo with the flag
const search = await call(`/api/search?q=${encodeURIComponent('ديمو')}`, 'GET', null, uA.token);
const hit = search.data.items.find((it) => it.userId === uD1.user.id);
assert(search.ok && hit && hit.isDemo === true, 'search returns demo user with isDemo=true');

// discovery from a real user includes the demo with the flag
const disc = await call('/api/discovery/recommendations?limit=50', 'GET', null, uA.token);
const dhit = disc.data.recommendations.find((c) => c.userId === uD1.user.id);
assert(disc.ok && dhit && dhit.isDemo === true, 'discovery returns demo user with isDemo=true');

// real -> demo like is blocked
const blocked1 = await call(`/api/matches/${uD1.user.id}/like`, 'POST', { like: true }, uA.token);
assert(blocked1.status === 403 && blocked1.data.code === 'DEMO_INTERACTION_BLOCKED', 'real->demo like blocked (403 DEMO_INTERACTION_BLOCKED)');

// demo -> real like is blocked
const blocked2 = await call(`/api/matches/${uA.user.id}/like`, 'POST', { like: true }, uD1.token);
assert(blocked2.status === 403 && blocked2.data.code === 'DEMO_INTERACTION_BLOCKED', 'demo->real like blocked (403 DEMO_INTERACTION_BLOCKED)');

// demo <-> demo like still works and creates a mutual with isDemo surfaced
const l1 = await call(`/api/matches/${uD2.user.id}/like`, 'POST', { like: true }, uD1.token);
assert(l1.ok && l1.data.mutual === false, 'demo->demo like ok (mutual=false)');
const l2 = await call(`/api/matches/${uD1.user.id}/like`, 'POST', { like: true }, uD2.token);
assert(l2.ok && l2.data.mutual === true, 'demo->demo like ok (mutual=true)');
const mutuals = await call('/api/matches/mutual', 'GET', null, uD1.token);
const m = mutuals.data.matches.find((x) => x.userId === uD2.user.id);
assert(mutuals.ok && m && m.isDemo === true, 'mutuals list includes demo partner with isDemo=true');

console.log('ALL PASSED');
