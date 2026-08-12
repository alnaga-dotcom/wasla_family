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

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

// wrong credentials rejected
const bad = await call('/admin/login', 'POST', { username: 'admin', password: 'wrongpass' });
assert(bad.status === 401 && bad.data.code === 'ADMIN_BAD_CREDENTIALS', 'admin login rejects wrong password (401)');

// correct credentials mint a super_admin token
const ok = await call('/admin/login', 'POST', { username: 'admin', password: 'admin' });
assert(ok.ok && ok.data.token && ok.data.role === 'super_admin', 'admin login (admin/admin) returns token');
const adminToken = ok.data.token;

// token is valid via /admin/me
const me = await call('/admin/me', 'GET', null, adminToken);
assert(me.ok && me.data.role === 'super_admin', '/admin/me valid with admin token');

// token grants dashboard access (super_admin permission check)
const dash = await call('/admin/dashboard', 'GET', null, adminToken);
assert(dash.ok && typeof dash.data.users === 'number', 'admin token grants /admin/dashboard (super_admin)');

// a plain/garbage token is rejected by admin endpoints
const badDash = await call('/admin/dashboard', 'GET', null, 'garbage');
assert(badDash.status === 403 && badDash.data.code === 'ADMIN_REQUIRED', 'garbage token rejected by admin endpoint (403)');

// create a member account directly from the panel
const panelPhone = '01' + String(100000000 + Math.floor(Math.random() * 899999999)); // 01 + 9 digits = 11
const created = await call('/admin/users', 'POST', {
  name: 'عضو من اللوحة',
  phone: panelPhone,
  gender: 'male',
  role: 'user',
  email: 'panel' + panelPhone + '@example.com',
}, adminToken);
assert(created.ok && created.data.userId && created.data.phone === '+2' + panelPhone, 'admin creates member (201 userId=' + created.data.userId + ')');
const newUserId = created.data.userId;

// duplicate phone rejected
const dup = await call('/admin/users', 'POST', {
  name: 'مكرر',
  phone: panelPhone,
  gender: 'male',
  role: 'user',
}, adminToken);
assert(dup.status === 409 && dup.data.code === 'ALREADY_REGISTERED', 'create duplicate phone rejected (409)');

// users list supports status filter and returns the new member
const active = await call('/admin/users?status=active&q=' + panelPhone, 'GET', null, adminToken);
assert(active.ok && active.data.users.some((u) => u.id === newUserId), 'GET /admin/users?status=active&q finds created member');

// violators list present (may be empty, but endpoint works)
const violators = await call('/admin/violators', 'GET', null, adminToken);
assert(violators.ok && Array.isArray(violators.data.violators), 'GET /admin/violators returns list');

// ban-from-report: register reporter + suspect, report, then ban via panel
const crypto = await import('node:crypto');
const pRep = '011' + String(crypto.randomInt(10000000, 99999999)); // 011 + 8 = 11 digits
const pSus = '012' + String(crypto.randomInt(10000000, 99999999));
const regRep = await call('/api/auth/register', 'POST', { name: 'مُبلّغ', phone: pRep, gender: 'female', email: 'rep@example.com' });
const repId = regRep.data.userId;
const verRep = await call('/api/auth/otp/verify', 'POST', { phone: pRep, code: regRep.data.dev.otp });
const regSus = await call('/api/auth/register', 'POST', { name: 'مُبلَّغ عنه', phone: pSus, gender: 'male', email: 'sus@example.com' });
const susId = regSus.data.userId;
await call('/api/auth/otp/verify', 'POST', { phone: pSus, code: regSus.data.dev.otp });
const report = await call('/api/report/' + susId, 'POST', { reason: 'سلوك غير لائق' }, verRep.data.token);
assert(report.ok, 'reporter files report against suspect');
const reportId = report.data.reportId;

const ban = await call('/admin/reports/' + reportId + '/ban', 'POST', { reason: 'حظر من البلاغ' }, adminToken);
assert(ban.ok && ban.data.userId === susId && ban.data.status === 'suspended', 'admin bans reported member via report (' + reportId + ')');

const violators2 = await call('/admin/violators', 'GET', null, adminToken);
assert(violators2.data.violators.some((v) => v.id === susId), 'banned member appears in violators list');

// logout revokes the token
const out = await call('/admin/logout', 'POST', null, adminToken);
assert(out.ok, 'admin logout succeeds');
const meAfter = await call('/admin/me', 'GET', null, adminToken);
assert(meAfter.status === 401, 'admin token revoked after logout (401)');

console.log('ALL PASSED');