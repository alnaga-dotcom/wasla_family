const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const r = await fetch(API + '/api/health');
assert(r.status === 200, 'health endpoint reachable');
const h = await r.json();
assert(h.ok === true, 'health reports db ok');
assert(h.service === 'wasla-server', 'health has service name');

// Security headers
const headers = r.headers;
assert(headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options nosniff');
assert(headers.get('x-frame-options') === 'DENY', 'X-Frame-Options DENY');
assert(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy');
assert(headers.get('x-powered-by') === null, 'X-Powered-By removed');

// CSP
const csp = headers.get('content-security-policy');
assert(csp && csp.includes("default-src 'self'"), 'CSP default-src self');

// CORS in development
const cors = await fetch(API + '/api/health', {
  method: 'GET',
  headers: { Origin: 'http://localhost:8081' },
});
assert(cors.headers.get('access-control-allow-origin')?.includes('8081'), 'CORS allows dev origin');

// JSON size limit: send a 20MB body
const big = JSON.stringify({ x: 'a'.repeat(25 * 1024 * 1024) });
const bigRes = await fetch(API + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: big,
});
assert(bigRes.status === 413, 'large JSON rejected with 413');

// HPP: duplicate query params
const hppRes = await fetch(API + '/api/health?x=1&x=2');
assert(hppRes.status === 200, 'HPP does not break health');

// --- Production boot + CORS behavior (spawn a separate prod server on :4100) ---
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prod = spawn(process.execPath, ['src/server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '4100',
    WASLA_DEV_OTP: 'false',
    WASLA_ADMIN_KEY: 'prod-smoke-key-5f9c2b7d1a3e',
    WASLA_PUBLIC_DOMAIN: 'https://wasla.family',
    WASLA_CORS_ORIGINS: 'https://wasla.family,https://app.wasla.family',
    WASLA_OTP_PROVIDER: 'email',
    SMTP_HOST: 'localhost',
    SMTP_USER: 'smoke',
    SMTP_PASS: 'smoke',
  },
  stdio: 'ignore',
});

await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('prod server boot timeout')), 15000);
  const poll = async () => {
    try {
      const r = await fetch('http://127.0.0.1:4100/api/health');
      if (r.status === 200) { clearTimeout(t); res(); }
      else setTimeout(poll, 250);
    } catch { setTimeout(poll, 250); }
  };
  poll();
});

try {
  const noOrigin = await fetch('http://127.0.0.1:4100/api/health');
  assert(noOrigin.status === 200, 'production allows no-Origin (native/webhook) requests');

  const cap = await fetch('http://127.0.0.1:4100/api/public/stats', {
    headers: { Origin: 'http://localhost' },
  });
  assert(cap.status === 200, 'production allows Capacitor localhost origin');

  const evil = await fetch('http://127.0.0.1:4100/api/public/stats', {
    headers: { Origin: 'https://evil.example' },
  });
  assert(evil.status === 403, 'production blocks disallowed browser origin');
} finally {
  prod.kill();
}

console.log('ALL SECURITY TESTS PASSED');
