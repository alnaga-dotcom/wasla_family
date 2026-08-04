const BASE = 'http://127.0.0.1:4000';
const ADMIN_KEY = 'dev-admin-key-change-me';

async function call(path, method, body, token, adminKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function newUser(name, phone, gender = 'male') {
  const reg = await call('/api/auth/register', 'POST', { name, phone, gender });
  if (reg.ok) return (await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp })).data;
  if (reg.data.code === 'ALREADY_REGISTERED') {
    const login = await call('/api/auth/login', 'POST', { phone });
    return (await call('/api/auth/otp/verify', 'POST', { phone, code: login.data.dev.otp })).data;
  }
  throw new Error('register failed: ' + JSON.stringify(reg.data));
}

async function makeMutual(a, b) {
  await call(`/api/matches/${b.user.id}/like`, 'POST', { like: true }, a.token);
  await call(`/api/matches/${a.user.id}/like`, 'POST', { like: true }, b.token);
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const a = await newUser('مراسل', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));
const b = await newUser('مستقبل', '010' + String(Math.floor(10000000 + Math.random() * 89999999)), 'female');
await makeMutual(a, b);

// Safe bio accepted
const safeBio = await call('/api/profile/me', 'PATCH', { field_key: 'bio', value: 'أحب السفر والقراءة والمشي.' }, a.token);
assert(safeBio.ok, 'safe bio accepted');

// Bio with phone rejected
const phoneBio = await call('/api/profile/me', 'PATCH', { field_key: 'bio', value: 'تواصل معي 01234567890' }, a.token);
assert(phoneBio.status === 422 && phoneBio.data.code === 'MODERATION_REJECT', 'phone in bio rejected');

// Bio with social app rejected
const socialBio = await call('/api/profile/me', 'PATCH', { field_key: 'bio', value: 'ابحث عني على واتساب' }, a.token);
assert(socialBio.status === 422 && socialBio.data.code === 'MODERATION_REJECT', 'social app in bio rejected');

// Safe message accepted
const safeMsg = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'أهلًا، كيف حالك؟' }, a.token);
assert(safeMsg.ok, 'safe message accepted');

// Message with phone rejected
const phoneMsg = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'اتصل بي على 01234567890' }, a.token);
assert(phoneMsg.status === 422 && phoneMsg.data.code === 'MODERATION_REJECT', 'phone in message rejected');

// Message with email rejected
const emailMsg = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'بريدي name(at)gmail(dot)com' }, a.token);
assert(emailMsg.status === 422 && emailMsg.data.code === 'MODERATION_REJECT', 'email in message rejected');

// Message with URL rejected
const urlMsg = await call(`/api/conversations/${b.user.id}/messages`, 'POST', { text: 'شاهد رابطي https://example.com' }, a.token);
assert(urlMsg.status === 422 && urlMsg.data.code === 'MODERATION_REJECT', 'url in message rejected');

// Admin moderation queue contains rejected items
const queue = await call('/admin/moderation?status=rejected', 'GET', null, null, ADMIN_KEY);
assert(queue.ok && queue.data.items.length >= 3, 'admin sees rejected moderation queue');

// Reviewer sees masked sensitive data
const phoneItem = queue.data.items.find((it) => it.item_type === 'message' && it.normalized_text.includes('0123456789'));
assert(phoneItem && phoneItem.originalText.includes('[رقم هاتف]'), 'reviewer sees masked phone');

// Resolve an item
const itemId = queue.data.items[0].id;
const resolved = await call(`/admin/moderation/${itemId}/resolve`, 'POST', { action: 'approve', reason: 'تمت المراجعة' }, null, ADMIN_KEY);
assert(resolved.ok && resolved.data.status === 'approved', 'admin approves moderation item');

const after = await call('/admin/moderation?status=approved', 'GET', null, null, ADMIN_KEY);
assert(after.ok && after.data.items.some((it) => it.id === itemId), 'resolved item appears in approved queue');

console.log('ALL MODERATION TESTS PASSED');
