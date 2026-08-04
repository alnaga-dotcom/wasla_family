const BASE = 'http://127.0.0.1:4000';
const ADMIN_KEY = 'dev-admin-key-change-me';

async function call(path, method, body, adminKey = ADMIN_KEY) {
  const headers = { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey };
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const review = await call('/admin/design-review', 'GET');
assert(review.ok && review.data.ok, 'design review returns ok');
assert(review.data.checks.some((c) => c.name === 'role_permission_matrix' && c.ok), 'role matrix check passes');
assert(review.data.checks.some((c) => c.name === 'match_threshold_default_60' && c.ok), 'match threshold check passes');
assert(review.data.checks.some((c) => c.name === 'canonical_plans' && c.ok), 'prices check passes');
assert(review.data.checks.some((c) => c.name === 'workflows_seeded' && c.ok), 'workflows seeded check passes');

// Reject without admin key
const noAuth = await call('/admin/design-review', 'GET', null, null);
assert(noAuth.status === 403, 'design-review rejects missing auth');

console.log('ALL DESIGN REVIEW TESTS PASSED');
