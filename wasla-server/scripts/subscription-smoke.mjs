const BASE = 'http://127.0.0.1:4000';

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
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender: 'male' });
  if (reg.ok) return (await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp })).data;
  if (reg.data.code === 'ALREADY_REGISTERED') {
    const login = await call('/api/auth/login', 'POST', { phone });
    const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: login.data.dev.otp });
    return ver.data;
  }
  throw new Error('register failed: ' + JSON.stringify(reg.data));
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function makeMutual(a, b) {
  await call(`/api/matches/${b.user.id}/like`, 'POST', { like: true }, a.token);
  await call(`/api/matches/${a.user.id}/like`, 'POST', { like: true }, b.token);
}

const a = await newUser('خالد', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
const b = await newUser('ليلى', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
await makeMutual(a, b);

const plans = await call('/api/plans', 'GET');
assert(plans.ok && plans.data.plans.length > 0, 'public plans list returned');
const monthly = plans.data.plans.find((p) => p.code === 'monthly');
assert(monthly && monthly.features.includes('unlimited_messages'), 'monthly plan has unlimited_messages');

// Free status: no active plan + quotas
const status = await call('/api/me/subscription', 'GET', null, a.token);
assert(status.ok && status.data.isPremium === false, 'free member status');
assert(status.data.quotas.messages.limit === 5, 'free daily message limit = 5');

// A sends 5 messages to B (new threads) — should succeed
for (let i = 0; i < 5; i++) {
  const sent = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'رسالة ' + (i + 1) }, a.token);
  assert(sent.ok, 'free message ' + (i + 1) + ' sent');
}

// 6th message should be blocked
const blocked = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'سادسة' }, a.token);
assert(blocked.status === 403 && blocked.data.code === 'MESSAGE_QUOTA_EXCEEDED', '6th message blocked by quota');

// B replies to A — should NOT consume A's quota, and should succeed regardless of B's quota
const reply = await call(`/api/conversations/${a.user.id}/messages`, 'POST', { text: 'رد من ليلى' }, b.token);
assert(reply.ok, 'reply to incoming message succeeds');

// A can now reply because B sent an incoming message
const aReply = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'رد من خالد' }, a.token);
assert(aReply.ok, 'A reply after incoming message does not consume quota');

// Like quota: A already used 1 like on B in makeMutual, so 4 more free likes, 5th blocked
const targets = [];
for (let i = 0; i < 5; i++) {
  const t = await newUser('هدف ' + i, '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
  targets.push(t);
}
for (let i = 0; i < 4; i++) {
  const like = await call(`/api/matches/${targets[i].user.id}/like`, 'POST', { like: true }, a.token);
  assert(like.ok, 'free like ' + (i + 1) + ' succeeded');
}
const like5 = await call(`/api/matches/${targets[4].user.id}/like`, 'POST', { like: true }, a.token);
assert(like5.status === 403 && like5.data.code === 'LIKE_QUOTA_EXCEEDED', '5th like blocked by quota (1 already used for mutual match)');

// Purchase premium for A
const purchase = await call('/api/me/subscription', 'POST', { planCode: 'monthly' }, a.token);
assert(purchase.ok && purchase.data.status === 'active', 'premium subscription activated');

const status2 = await call('/api/me/subscription', 'GET', null, a.token);
assert(status2.data.isPremium === true, 'member now premium');

// Premium A sends unlimited messages
const premiumMsg = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'رسالة بعد الاشتراك' }, a.token);
assert(premiumMsg.ok, 'premium message succeeds beyond free quota');

// Premium A can like beyond free quota
const likePremium = await call(`/api/matches/${targets[4].user.id}/like`, 'POST', { like: true }, a.token);
assert(likePremium.ok, 'premium like beyond free quota succeeds');

// Cancel subscription
const cancel = await call('/api/me/subscription/cancel', 'POST', {}, a.token);
assert(cancel.ok && cancel.data.cancelled === true, 'subscription cancelled');

const status3 = await call('/api/me/subscription', 'GET', null, a.token);
assert(status3.data.isPremium === false, 'after cancellation member is free');

console.log('ALL SUBSCRIPTION TESTS PASSED');
