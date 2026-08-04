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

const a = await newUser('رنا', 'female');
const b = await newUser('رؤى', 'female');

// nothing yet
const empty = await call('/api/notifications', 'GET', null, a.token);
assert(empty.ok && empty.data.unread === 0, 'no notifications initially');

// A likes B → B gets a like notification
await call('/api/matches/' + b.id + '/like', 'POST', { like: true }, a.token);
const notifB = await call('/api/notifications', 'GET', null, b.token);
assert(notifB.data.unread === 1 && notifB.data.notifications[0].type === 'like', 'B receives like notification');
assert(notifB.data.notifications[0].from_name === 'رنا', 'like notification carries sender name');

// B likes A → mutual → both get match notification
await call('/api/matches/' + a.id + '/like', 'POST', { like: true }, b.token);
const notifA = await call('/api/notifications', 'GET', null, a.token);
assert(notifA.data.notifications[0].type === 'match', 'A receives match notification');
const notifB2 = await call('/api/notifications', 'GET', null, b.token);
assert(notifB2.data.notifications[0].type === 'match', 'B receives match notification');
assert(notifA.data.unread === 2, 'A has 2 unread (like from B is old? no: A unread = like? none + match)');

// A messages B → B gets message notification
await call('/api/conversations/' + b.id + '/messages', 'POST', { text: 'أهلًا' }, a.token);
const notifB3 = await call('/api/notifications', 'GET', null, b.token);
assert(notifB3.data.notifications[0].type === 'message', 'B receives message notification');
assert(notifB3.data.unread === 3, 'B unread counts 3 (like, match, message)');

// mark one read
const one = notifB3.data.notifications[2];
const markOne = await call('/api/notifications/read', 'POST', { id: one.id }, b.token);
assert(markOne.data.unread === 2, 'marking one read leaves 2 unread');

// mark all read
const markAll = await call('/api/notifications/read', 'POST', {}, b.token);
assert(markAll.data.unread === 0, 'mark all read → unread=0');

console.log('ALL PASSED');
