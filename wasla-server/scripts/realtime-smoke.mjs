import WebSocket from 'ws';

const API = 'http://127.0.0.1:4000';
const WS = 'ws://127.0.0.1:4000/ws';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function register(name, gender) {
  const phone = '018' + String(Math.floor(10000000 + Math.random() * 89999999));
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

function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS + '?token=' + token);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitEvent(ws, expected, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for ' + expected)), timeout);
    const onMsg = (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.event === expected) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(data);
      }
    };
    ws.on('message', onMsg);
  });
}

const A = await register('WsSender', 'male');
const B = await register('WsReceiver', 'female');

// Reject unauthenticated connections
const bad = await new Promise((resolve) => {
  const ws = new WebSocket(WS);
  ws.on('close', (code) => resolve(code));
  ws.on('error', () => {});
});
assert(bad === 4001, 'unauthenticated socket rejected (code 4001)');

const wsA = await connect(A.token);
const wsB = await connect(B.token);

const like1 = waitEvent(wsB, 'LikeReceived');
await fetch(API + '/api/matches/' + B.userId + '/like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A.token },
  body: JSON.stringify({ like: true }),
});
const got = await like1;
assert(got.fromUserId === A.userId, 'B received live LikeReceived event');

const mutualA = waitEvent(wsA, 'MatchMutual');
const mutualB = waitEvent(wsB, 'MatchMutual');
await fetch(API + '/api/matches/' + A.userId + '/like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.token },
  body: JSON.stringify({ like: true }),
});
const [mA, mB] = await Promise.all([mutualA, mutualB]);
assert(mA.otherId === B.userId && mB.otherId === A.userId, 'both sides received MatchMutual');

const msgEvt = waitEvent(wsB, 'MessageReceived');
await fetch(API + '/api/conversations/' + B.userId + '/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A.token },
  body: JSON.stringify({ text: 'مرحبًا' }),
});
const msg = await msgEvt;
assert(msg.message.text === 'مرحبًا' && msg.message.senderId === A.userId, 'B received live message');

wsA.close();
wsB.close();
console.log('ALL WEBSOCKET TESTS PASSED');
