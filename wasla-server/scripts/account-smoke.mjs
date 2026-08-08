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

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function register(phone) {
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name: 'حساب اختبار', phone, gender: 'male', email });
  if (!reg.ok) throw new Error('register failed: ' + JSON.stringify(reg.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  if (!ver.ok) throw new Error('verify failed: ' + JSON.stringify(ver.data));
  return { token: ver.data.token, userId: ver.data.user.id };
}

async function login(phone) {
  const req = await call('/api/auth/login', 'POST', { phone });
  if (!req.ok) throw new Error('login failed: ' + JSON.stringify(req.data));
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: req.data.dev.otp });
  if (!ver.ok) throw new Error('verify failed: ' + JSON.stringify(ver.data));
  return { token: ver.data.token, userId: ver.data.user.id };
}

// ── هاتف دولي: +CC (رمز دولة غير مصري)
const intlPhone = '+971' + String(crypto.randomInt(500000000, 599999999));
const intl = await register(intlPhone);
assert(intl.userId > 0, 'تسجيل بهاتف دولي +971 يعمل');

// ── هاتف محلي: 01xxxxxxxxx
const localPhone = '01' + String(crypto.randomInt(100000000, 999999999));
const me = await register(localPhone);
for (const [k, v] of [['birth_year', '1998'], ['city', 'القاهرة'], ['profession', 'طب'], ['education', 'بكالوريوس'], ['religiosity', 'ملتزم'], ['lifestyle', 'هادئ'], ['photo_done', '1'], ['selfie_done', '1']]) {
  await call('/api/profile/me', 'PATCH', { field_key: k, value: v }, me.token);
}

// ── حذف الحساب مع مهلة التراجع
const del = await call('/api/me/account', 'DELETE', { reason: 'تجربة' }, me.token);
assert(del.ok && del.data.deleted === true && del.data.restoreBy, 'حذف الحساب يمنح مهلة للتراجع');

// الجلسة تُلغى فورًا
const meAfter = await call('/api/auth/me', 'GET', null, me.token);
assert(!meAfter.ok && meAfter.status === 401, 'الجلسة أُلغيت بعد الحذف');

// الدخول الجديد للحساب المحذوف: authRequired يمنع، authGrace يسمح
const re = await login(localPhone);
assert(re.token, 'يمكن الدخول مجددًا برقم محذوف (داخل المهلة)');
const meMe = await call('/api/auth/me', 'GET', null, re.token);
assert(!meMe.ok && meMe.data.code === 'ACCOUNT_DELETED', 'الحساب المحذوف محظور من واجهات الخدمة (403)');

const status = await call('/api/me/account/status', 'GET', null, re.token);
assert(status.ok && status.data.deleted === true && status.data.restoreBy, 'حالة الحساب: قيد الحذف مع تاريخ التراجع');

const exportAll = await call('/api/me/data', 'GET', null, re.token);
assert(exportAll.ok && exportAll.data.user && exportAll.data.profile !== undefined, 'تصدير بياناتي متاح أثناء المهلة');

// استبعاد المحذوف من الاكتشاف/البحث
const viewer = await register('01' + String(crypto.randomInt(100000000, 999999999)));
await call('/api/profile/me', 'PATCH', { field_key: 'city', value: 'القاهرة' }, viewer.token);
const search = await call('/api/search?q=' + encodeURIComponent('حساب اختبار'), 'GET', null, viewer.token);
assert(search.data.items.every((c) => c.userId !== me.userId), 'المحذوف لا يظهر في البحث');

// ── التراجع قبل انتهاء المهلة
const rest = await call('/api/me/account/restore', 'POST', null, re.token);
assert(rest.ok && rest.data.restored === true, 'استرجاع الحساب يعمل');

const back = await call('/api/auth/me', 'GET', null, re.token);
assert(back.ok && back.data.user.id === me.userId, 'الحساب عاد نشطًا بنفس الهوية');

const search2 = await call('/api/search?q=' + encodeURIComponent('حساب اختبار') + '&limit=50', 'GET', null, viewer.token);
assert(search2.data.items.some((c) => c.userId === me.userId), 'بعد الاسترجاع يظهر في البحث من جديد');

// استرجاع حساب غير محذوف: لا يخطئ
const again = await call('/api/me/account/restore', 'POST', null, re.token);
assert(again.ok && again.data.alreadyActive === true, 'الاسترجاع لحساب نشط يعيد الحالة بلا خطأ');

console.log('=== ALL PASSED ===');
