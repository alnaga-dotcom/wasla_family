const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

// Register with email (console provider logs)
const phone = '011' + String(Math.floor(10000000 + Math.random() * 89999999));
const email = `test-${Date.now()}@wasla.family`;
const reg = await fetch(API + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'OtpTester', gender: 'male', phone, email }),
});
const regData = await reg.json();
assert(reg.ok && regData.userId, 'register accepts email');
assert(regData.dev?.otp, 'devOtp echoes code for local testing');

// Verify with the code
const ver = await fetch(API + '/api/auth/otp/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone, code: regData.dev.otp }),
});
assert(ver.ok, 'OTP verification works after real send');

// Login sends OTP
const login = await fetch(API + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone }),
});
const loginData = await login.json();
assert(login.ok && loginData.dev?.otp, 'login triggers OTP send');

console.log('ALL OTP SEND TESTS PASSED');
