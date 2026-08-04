// Smoke test for the registration + profile flow (Wasla_03/07/29).
// Run: node scripts/smoke.mjs   (server must be running on port 4000)
const BASE = process.env.WASLA_BASE || 'http://127.0.0.1:4000';
const phone = '011' + String(Math.floor(10000000 + Math.random() * 89999999));

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function log(label, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
}

const results = [];

async function step(label, fn, expectedStatus) {
  try {
    const { status, json } = await fn();
    const ok = expectedStatus ? status === expectedStatus : status >= 200 && status < 300;
    results.push(ok);
    log(label, ok, `${status} ${JSON.stringify(json).slice(0, 160)}`);
    return json;
  } catch (e) {
    results.push(false);
    log(label, false, e.message);
    return null;
  }
}

let reg = null;
await step('1. Register new phone', () => {
  return call('POST', '/api/auth/register', { name: 'أحمد التجريبي', phone, gender: 'male' }).then((r) => { reg = r; return r; });
});

const otp = reg && reg.json.dev ? reg.json.dev.otp : null;

if (!otp) {
  log('2. (skipped) OTP', false, 'dev echo off');
} else {
  const verified = await step('2. Verify OTP → token', () => call('POST', '/api/auth/otp/verify', { phone, code: otp }));
  const token = verified && verified.token;

  await step('3. Wrong OTP rejected', () => call('POST', '/api/auth/otp/verify', { phone, code: '000000' }), 401);

  if (token) {
    await step('4. GET /auth/me', () => call('GET', '/api/auth/me', null, token));
    await step('5. Profile completion 0%', () => call('GET', '/api/profile/completion', null, token));
    await step('6. Patch city', () => call('PATCH', '/api/profile/me', { field_key: 'city', value: 'القاهرة' }, token));
    await step('7. Patch profession', () => call('PATCH', '/api/profile/me', { field_key: 'profession', value: 'تقنية' }, token));
    await step('8. Patch selfie done', () => call('PATCH', '/api/profile/me', { field_key: 'selfie_done', value: 1 }, token));
    await step('9. Invalid age rejected', () => call('PATCH', '/api/profile/me', { field_key: 'age', value: 12 }, token), 422);
    await step('10. GET profile/me (final)', () => call('GET', '/api/profile/me', null, token));
    await step('11. Logout', () => call('POST', '/api/auth/logout', {}, token));
    await step('12. Token revoked after logout', () => call('GET', '/api/auth/me', null, token), 401);
  }
}

console.log('\n=== ' + results.filter(Boolean).length + '/' + results.length + ' checks passed ===');
process.exit(results.every(Boolean) ? 0 : 1);
