const BASE = process.env.WASLA_BASE || 'http://127.0.0.1:4000';

async function call(path) {
  const res = await fetch(BASE + path);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const health = await call('/api/health');
assert(health.status === 200 && health.data.ok === true, 'health endpoint returns 200');
assert(health.data.service === 'wasla-server', 'health reports service name');
assert(health.data.env === 'production' || health.data.env === 'development', 'health reports environment');

console.log('ALL DEPLOYMENT CHECKS PASSED');
