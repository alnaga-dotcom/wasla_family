const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function register(name, gender) {
  const phone = '016' + String(Math.floor(10000000 + Math.random() * 89999999));
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

const u = await register('PayTester', 'male');

const st = await fetch(API + '/api/payments/status').then((r) => r.json());
assert(st.provider === 'mock' && st.live === false, 'mock provider active by default');

const plans = await fetch(API + '/api/plans').then((r) => r.json());
assert(plans.plans.length > 0, 'plans listed');

const buy = await fetch(API + '/api/me/subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token },
  body: JSON.stringify({ planCode: plans.plans[0].code }),
});
const buyData = await buy.json();
assert(buy.status === 201 && buyData.status === 'active', 'mock purchase activates instantly');
assert(buyData.gateway === 'mock', 'gateway reported as mock');

const sub = await fetch(API + '/api/me/subscription', {
  headers: { Authorization: 'Bearer ' + u.token },
}).then((r) => r.json());
assert(sub.isPremium === true, 'subscription shows premium');

const cancel = await fetch(API + '/api/me/subscription/cancel', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + u.token },
}).then((r) => r.json());
assert(cancel.cancelled === true, 'subscription cancelled');

console.log('ALL PAYMENT TESTS PASSED');
