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

async function session(phone) {
  const login = await call('/api/auth/login', 'POST', { phone });
  if (!login.ok) throw new Error('login failed: ' + JSON.stringify(login.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: login.data.dev.otp });
  return ver.data;
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function newUser(name, phone) {
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender: 'female', email });
  if (reg.ok) return (await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp })).data;
  if (reg.data.code === 'ALREADY_REGISTERED') return session(phone);
  throw new Error('register failed: ' + JSON.stringify(reg.data));
}

const randPhone = () => '010' + String(Math.floor(10000000 + Math.random() * 89999999));
const a = await newUser('منى', randPhone());
const b = await newUser('سلمى', randPhone());
const idA = a.user.id, idB = b.user.id;

// build a fresh mutual pair
await call(`/api/matches/${idB}/like`, 'POST', { like: true }, a.token);
await call(`/api/matches/${idA}/like`, 'POST', { like: true }, b.token);

// non-mutual guard: create a third user with no likes and try to message
const cPhone = randPhone();
const cEmail = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
const reg = await call('/api/auth/register', 'POST', { name: 'غريب', phone: cPhone, gender: 'male', email: cEmail });
const c = reg.ok
  ? (await call('/api/auth/otp/verify', 'POST', { phone: cPhone, code: reg.data.dev.otp })).data
  : await session(cPhone);

const blocked = await call(`/api/conversations/${idA}/messages`, 'POST', { text: 'لا يجب أن يصل' }, c.token);
assert(blocked.status === 403, 'non-mutual member cannot message (403)');

// conversations list for A should contain B
const convA = await call('/api/conversations', 'GET', null, a.token);
assert(convA.data.conversations.some((c2) => c2.userId === idB), 'A sees B in conversations');

// send message A->B
const sent = await call(`/api/conversations/${idB}/messages`, 'POST', { text: 'أهلًا كريم، سعدت بالمطابقة' }, a.token);
assert(sent.ok && sent.data.message.id > 0, 'A sends text message');

// B unread = 1, then B reads, unread = 0
const convB = await call('/api/conversations', 'GET', null, b.token);
const cB = convB.data.conversations.find((c2) => c2.userId === idA);
assert(cB && cB.unread >= 1 && cB.lastMessage.text === 'أهلًا كريم، سعدت بالمطابقة', `B sees unread=${cB && cB.unread} lastMessage="${cB && cB.lastMessage.text}"`);

const read = await call(`/api/conversations/${idA}/messages/${sent.data.message.id}/read`, 'POST', {}, b.token);
assert(read.ok, 'B marks read');
const convB2 = await call('/api/conversations', 'GET', null, b.token);
const cB2 = convB2.data.conversations.find((c2) => c2.userId === idA);
assert(cB2.unread === 0, 'unread cleared after read');

// history for A has the message
const hist = await call(`/api/conversations/${idB}/messages`, 'GET', null, a.token);
assert(hist.data.messages.some((m) => m.text === 'أهلًا كريم، سعدت بالمطابقة'), 'history contains sent message');

// ephemeral photo
const eph = await call(`/api/conversations/${idB}/photo-ephemeral`, 'POST', {}, a.token);
assert(eph.ok && eph.data.message.kind === 'ephemeral', 'ephemeral photo sent');
const hist2 = await call(`/api/conversations/${idB}/messages`, 'GET', null, a.token);
assert(hist2.data.messages.some((m) => m.kind === 'ephemeral'), 'ephemeral appears in history as kind=ephemeral');

// block: A blocks B, then B cannot message A
const blk = await call(`/api/block/${idB}`, 'POST', {}, a.token);
assert(blk.ok, 'A blocks B');
const after = await call(`/api/conversations/${idA}/messages`, 'POST', { text: 'محاولة بعد الحظر' }, b.token);
assert(after.status === 403, 'B cannot message after being blocked (403)');

// report
const rep = await call(`/api/report/${idB}`, 'POST', { reason: 'رسائل مزعجة' }, a.token);
assert(rep.ok && rep.data.status === 'pending', 'report recorded as pending');

console.log('ALL PASSED');
