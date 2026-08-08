const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function register(name, gender) {
  const phone = '017' + String(Math.floor(10000000 + Math.random() * 89999999));
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await fetch(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gender, phone, email }),
  });
  const data = await reg.json();
  const ver = await fetch(API + '/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: data.dev.otp }),
  });
  const v = await ver.json();
  return { token: v.token, userId: v.user.id };
}

const u = await register('VerifyMe', 'female');

let me = await fetch(API + '/api/verification/me', {
  headers: { Authorization: 'Bearer ' + u.token },
}).then((r) => r.json());
assert(me.verified === false, 'not verified initially');

const req = await fetch(API + '/api/verification/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
  body: JSON.stringify({ type: 'id', note: 'national id attached' }),
});
assert(req.status === 201, 'verification request created');

const dup = await fetch(API + '/api/verification/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
  body: JSON.stringify({ type: 'id' }),
});
assert(dup.status === 409, 'duplicate request rejected');

const list = await fetch(API + '/api/admin/verification', {
  headers: { 'X-Admin-Key': 'dev-admin-key-change-me' },
}).then((r) => r.json());
assert(Array.isArray(list.requests) && list.requests.length >= 1, 'officer sees pending requests');
const reqId = list.requests.find((x) => x.user_id === u.userId).id;

const dec = await fetch(API + '/api/admin/verification/' + reqId + '/decision', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'dev-admin-key-change-me' },
  body: JSON.stringify({ approve: true }),
});
const decData = await dec.json();
assert(dec.ok && decData.result.status === 'approved', 'verification approved');

me = await fetch(API + '/api/verification/me', {
  headers: { Authorization: 'Bearer ' + u.token },
}).then((r) => r.json());
assert(me.verified === true, 'user now verified');

console.log('ALL VERIFICATION TESTS PASSED');
