const BASE = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

async function call(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function register() {
  const phone = '010' + String(Math.floor(10000000 + Math.random() * 89999999));
  const email = 'tester' + String(Math.floor(100000 + Math.random() * 899999)) + '@example.com';
  const reg = await call('/api/auth/register', 'POST', { name: 'صورة', gender: 'male', phone, email });
  const ver = await call('/api/auth/otp/verify', 'POST', { phone, code: reg.data.dev.otp });
  return ver.data;
}

// Minimal 1x1 red PNG
const pngHex = '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636460606000000002000149000A5B0000000049454E44AE426082';
const pngBuffer = Buffer.from(pngHex, 'hex');

const user = await register();
assert(user.user.trustLevel === 1, 'initial trust level is 1');

// Upload profile photo
const profileForm = new FormData();
profileForm.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'profile.png');
const profileRes = await fetch(BASE + '/api/profile/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + user.token }, body: profileForm });
assert(profileRes.status === 201, 'profile photo upload returns 201');
const profileData = await profileRes.json();
assert(profileData.ok && profileData.url, 'profile photo upload returns url');

// Upload selfie
const selfieForm = new FormData();
selfieForm.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'selfie.png');
const selfieRes = await fetch(BASE + '/api/profile/selfie', { method: 'POST', headers: { Authorization: 'Bearer ' + user.token }, body: selfieForm });
assert(selfieRes.status === 201, 'selfie upload returns 201');
const selfieData = await selfieRes.json();
assert(selfieData.ok && selfieData.url, 'selfie upload returns url');

// Fetch photos list
const photos = await call('/api/profile/photos', 'GET', null, user.token);
assert(photos.ok && photos.data.profile && photos.data.selfie, 'photos list contains both');

// View own profile photo
const imgRes = await fetch(BASE + photos.data.profile.url, { headers: { Authorization: 'Bearer ' + user.token } });
assert(imgRes.status === 200 && imgRes.headers.get('content-type') === 'image/png', 'photo is served with correct mime');

// Another user cannot view selfie
const other = await register();
const selfieBlock = await fetch(BASE + photos.data.selfie.url, { headers: { Authorization: 'Bearer ' + other.token } });
assert(selfieBlock.status === 403, 'selfie is private to owner');

// Trust level raised after selfie
const me = await call('/api/profile/me', 'GET', null, user.token);
assert(me.data.user.trustLevel === 2, 'trust level raised to 2 after selfie');

console.log('ALL PHOTO TESTS PASSED');
