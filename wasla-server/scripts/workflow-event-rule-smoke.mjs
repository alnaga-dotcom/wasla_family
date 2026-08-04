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

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const u = await newUser('مستخدم حدث', '010' + String(Math.floor(10000000 + Math.random() * 89999999)));

// Registration published events
const events = await call('/admin/events?type=UserRegistered', 'GET', null, null, ADMIN_KEY);
assert(events.ok && events.data.events.some((e) => e.user_id === u.user.id), 'UserRegistered event stored');

// Workflows are seeded
const workflows = await call('/admin/workflows', 'GET', null, null, ADMIN_KEY);
assert(workflows.ok && workflows.data.definitions.some((d) => d.key === 'account'), 'account workflow seeded');
const accountWorkflow = workflows.data.definitions.find((d) => d.key === 'account');

// Account workflow instance exists for user
const instances = await call('/admin/workflows', 'GET', null, null, ADMIN_KEY);
assert(instances.data.instances.some((i) => i.def_key === 'account' && i.entity_id === String(u.user.id)), 'account workflow instance exists');
const inst = instances.data.instances.find((i) => i.def_key === 'account' && i.entity_id === String(u.user.id));
assert(inst.current_state === 'active', 'account workflow reached active');

// Admin transitions a workflow manually
const trans = await call(`/admin/workflows/instances/${inst.id}/transition`, 'POST', { toState: 'suspended', reason: 'test' }, null, ADMIN_KEY);
assert(trans.ok && trans.data.currentState === 'suspended', 'admin can transition workflow');

// Admin creates a rule and tests it
const rule = await call('/admin/rules', 'POST', {
  name: 'Block messages from test user',
  eventType: 'MessageSent',
  conditions: [{ all: [{ field: 'sender.userId', operator: 'equals', value: u.user.id }] }],
  actions: [{ type: 'deny_action', reason: 'test_rule' }],
  priority: 10,
  userMessage: 'تم حظر الإرسال بواسطة قاعدة اختبار',
}, null, ADMIN_KEY);
assert(rule.ok, 'admin creates rule');

const testResult = await call(`/admin/rules/${rule.data.id}/test`, 'POST', { context: { sender: { userId: u.user.id } } }, null, ADMIN_KEY);
assert(testResult.ok && testResult.data.result.matched, 'rule test matches correct context');

const testResult2 = await call(`/admin/rules/${rule.data.id}/test`, 'POST', { context: { sender: { userId: 99999 } } }, null, ADMIN_KEY);
assert(testResult2.ok && !testResult2.data.result.matched, 'rule test does not match wrong context');

// Admin publishes a custom event
const pub = await call('/admin/events/publish', 'POST', { type: 'CustomEvent', payload: { x: 1 }, userId: u.user.id, entityType: 'test', entityId: '1' }, null, ADMIN_KEY);
assert(pub.ok, 'admin publishes custom event');

const customEvents = await call('/admin/events?type=CustomEvent', 'GET', null, null, ADMIN_KEY);
assert(customEvents.data.events.some((e) => e.event_id === pub.data.eventId), 'custom event retrievable');

console.log('ALL WORKFLOW/EVENT/RULE TESTS PASSED');
