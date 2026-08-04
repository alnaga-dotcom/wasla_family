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

async function newUser() {
  const phone = '01' + String(crypto.randomInt(100000000, 999999999));
  const reg = await call('/api/auth/register', 'POST', { name: 'ثقة', phone, gender: 'male' });
  if (!reg.ok) throw new Error('register failed: ' + JSON.stringify(reg.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  return { token: ver.data.token, userId: ver.data.user.id };
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function patch(token, key, value) {
  const r = await call('/api/profile/me', 'PATCH', { field_key: key, value }, token);
  if (!r.ok) throw new Error('patch ' + key + ' failed: ' + JSON.stringify(r.data));
}

const A = await newUser(); // L1: تسجيل فقط
const B = await newUser(); // L2: سيلفي
const C = await newUser(); // L3: كامل

await patch(B.token, 'selfie_done', '1');
for (const [k, v] of [['selfie_done', '1'], ['photo_done', '1'], ['city', 'القاهرة'], ['profession', 'طب'], ['education', 'بكالوريوس']]) {
  await patch(C.token, k, v);
}

const tA = await call('/api/trust/me', 'GET', null, A.token);
assert(tA.ok && tA.data.trust.level === 1, 'L1: تسجيل فقط = مستوى 1');
assert(tA.data.trust.factors.some((f) => f.key === 'selfie' && !f.done), 'L1: عامل السيلفي غير مكتمل');

const tB = await call('/api/trust/me', 'GET', null, B.token);
assert(tB.ok && tB.data.trust.level === 2, 'L2: سيلفي فقط = مستوى 2');

const tC = await call('/api/trust/me', 'GET', null, C.token);
assert(tC.ok && tC.data.trust.level === 3, 'L3: سيلفي + صورة + بيانات أساسية = مستوى 3');
assert(tC.data.trust.factors.every((f) => f.done), 'L3: كل عوامل الثقة مكتملة');

const prof = await call(`/api/users/${C.userId}/profile`, 'GET', null, A.token);
assert(prof.ok && prof.data.profile.trustLevel === 3, 'الملف يعرض trustLevel للآخرين');

const profSelf = await call(`/api/users/${A.userId}/profile`, 'GET', null, A.token);
assert(!profSelf.ok && profSelf.status === 422, 'الملف الذاتي مرفوض (422)');

console.log('=== ALL PASSED ===');
