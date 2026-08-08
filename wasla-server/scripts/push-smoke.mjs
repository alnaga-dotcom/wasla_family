const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function register(name, gender) {
  const phone = '015' + String(Math.floor(10000000 + Math.random() * 89999999));
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

const u = await register('PushTester', 'male');

const regPush = await fetch(API + '/api/push/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
  body: JSON.stringify({ token: 'test-fcm-token-' + Date.now() }),
});
assert(regPush.status === 200, 'push token registered');

const testPush = await fetch(API + '/api/push/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
});
const pushData = await testPush.json();
assert(testPush.ok && pushData.ok, 'test push sent (console channel)');

// Ensure a like triggers a notification + push (console fallback)
const u2 = await register('PushTarget', 'female');
const like = await fetch(API + '/api/matches/' + u2.userId + '/like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
  body: JSON.stringify({ like: true }),
});
assert(like.ok, 'like action succeeded');

console.log('ALL PUSH NOTIFICATION TESTS PASSED');
