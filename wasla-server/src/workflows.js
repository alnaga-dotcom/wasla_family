import { db, nowIso } from './db.js';
import { publish } from './events.js';

export async function createDefinition({ key, version = 1, name, states, transitions, status = 'published' }) {
  const r = await db.prepare(
    `INSERT INTO workflow_definitions (wf_key, version, name, states, transitions, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(key, version, name, JSON.stringify(states), JSON.stringify(transitions), status);
  return Number(r.lastInsertRowid);
}

export async function getDefinition(id) {
  return db.prepare('SELECT * FROM workflow_definitions WHERE id = ?').get(id);
}

export async function getPublishedDefinition(key) {
  return db.prepare("SELECT * FROM workflow_definitions WHERE wf_key = ? AND status = 'published' ORDER BY version DESC LIMIT 1").get(key);
}

export async function listDefinitions() {
  const rows = await db.prepare('SELECT * FROM workflow_definitions ORDER BY wf_key, version DESC').all();
  return rows.map(({ wf_key, ...rest }) => ({ ...rest, key: wf_key }));
}

export async function startInstance(definitionKey, entityType, entityId, context = {}, initialState = null) {
  const def = await getPublishedDefinition(definitionKey);
  if (!def) throw new Error('Workflow definition not found: ' + definitionKey);
  const states = JSON.parse(def.states);
  const startState = initialState || states[0];
  try {
    const r = await db.prepare(
      `INSERT INTO workflow_instances (definition_id, entity_type, entity_id, current_state, context)
       VALUES (?, ?, ?, ?, ?)`
    ).run(def.id, entityType, String(entityId), startState, JSON.stringify(context));
    const instanceId = Number(r.lastInsertRowid);
    await logHistory(instanceId, null, startState, null, null, 'started');
    return { instanceId, currentState: startState };
  } catch (e) {
    if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || String(e).includes('Duplicate entry'))) {
      const existing = await db.prepare('SELECT * FROM workflow_instances WHERE definition_id = ? AND entity_type = ? AND entity_id = ?').get(def.id, entityType, String(entityId));
      return { instanceId: existing.id, currentState: existing.current_state };
    }
    throw e;
  }
}

export async function getInstance(instanceId) {
  const inst = await db.prepare('SELECT * FROM workflow_instances WHERE id = ?').get(instanceId);
  if (!inst) return null;
  const def = await getDefinition(inst.definition_id);
  return { ...inst, definition: def, context: JSON.parse(inst.context || '{}') };
}

export async function listInstances({ definitionKey, state, entityType, limit = 100 } = {}) {
  let sql = `SELECT wi.*, wd.wf_key AS def_key, wd.name AS def_name FROM workflow_instances wi
             JOIN workflow_definitions wd ON wd.id = wi.definition_id WHERE 1=1`;
  const params = [];
  if (definitionKey) { sql += ' AND wd.wf_key = ?'; params.push(definitionKey); }
  if (state) { sql += ' AND wi.current_state = ?'; params.push(state); }
  if (entityType) { sql += ' AND wi.entity_type = ?'; params.push(entityType); }
  sql += ' ORDER BY wi.updated_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

async function logHistory(instanceId, fromState, toState, actorId, actorRole, reason) {
  await db.prepare(
    `INSERT INTO workflow_history (instance_id, from_state, to_state, actor_id, actor_role, reason)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(instanceId, fromState, toState, actorId || null, actorRole || null, reason || null);
}

export async function transition(instanceId, targetState, { actorId = null, actorRole = null, reason = null } = {}) {
  const inst = await getInstance(instanceId);
  if (!inst) throw new Error('Instance not found');
  const def = await getDefinition(inst.definition_id);
  const transitions = JSON.parse(def.transitions);
  const valid = transitions.some((t) => t.from === inst.current_state && t.to === targetState);
  if (!valid) throw new Error(`Invalid transition: ${inst.current_state} -> ${targetState}`);

  const now = nowIso();
  await db.prepare(
    `UPDATE workflow_instances SET current_state = ?, previous_state = ?, updated_at = ? WHERE id = ?`
  ).run(targetState, inst.current_state, now, instanceId);
  await logHistory(instanceId, inst.current_state, targetState, actorId, actorRole, reason);

  await publish(
    `WorkflowTransitioned`,
    { instanceId, definitionKey: def.wf_key, fromState: inst.current_state, toState: targetState, reason },
    'workflow',
    { userId: actorId, entityType: inst.entity_type, entityId: inst.entity_id }
  );

  // Canonical event mapping
  const canonicalMap = {
    account: { deleted: 'UserDeleted', suspended: 'UserSuspended', active: 'SuspensionLifted' },
    subscription: { active: 'SubscriptionActivated', expired: 'SubscriptionExpired', cancelled: 'SubscriptionCancelled' },
    report: { resolved: 'ReportResolved', dismissed: 'ReportResolved' },
    moderation: { approved: 'ContentFlaggedForReview', rejected: 'ContentRejected' },
  };
  const canonical = canonicalMap[def.wf_key]?.[targetState];
  if (canonical) {
    await publish(canonical, { instanceId, state: targetState }, 'workflow', { userId: actorId, entityType: inst.entity_type, entityId: inst.entity_id });
  }

  return { instanceId, currentState: targetState, previousState: inst.current_state };
}

export async function seedDefaultWorkflows() {
  const defs = [
    {
      key: 'account', name: 'Account Lifecycle',
      states: ['registered', 'phone_verified', 'active', 'inactive', 'suspended', 'deleted'],
      transitions: [
        { from: 'registered', to: 'phone_verified' },
        { from: 'phone_verified', to: 'active' },
        { from: 'active', to: 'inactive' },
        { from: 'inactive', to: 'active' },
        { from: 'active', to: 'suspended' },
        { from: 'suspended', to: 'active' },
        { from: 'active', to: 'deleted' },
        { from: 'inactive', to: 'deleted' },
        { from: 'suspended', to: 'deleted' },
      ],
    },
    {
      key: 'subscription', name: 'Subscription Lifecycle',
      states: ['pending', 'paid', 'active', 'expired', 'cancelled'],
      transitions: [
        { from: 'pending', to: 'paid' },
        { from: 'paid', to: 'active' },
        { from: 'active', to: 'expired' },
        { from: 'active', to: 'cancelled' },
        { from: 'cancelled', to: 'expired' },
      ],
    },
    {
      key: 'report', name: 'Report Lifecycle',
      states: ['open', 'under_review', 'resolved', 'dismissed'],
      transitions: [
        { from: 'open', to: 'under_review' },
        { from: 'under_review', to: 'resolved' },
        { from: 'under_review', to: 'dismissed' },
      ],
    },
    {
      key: 'moderation', name: 'Content Moderation Lifecycle',
      states: ['submitted', 'auto_review', 'manual_review', 'approved', 'rejected'],
      transitions: [
        { from: 'submitted', to: 'auto_review' },
        { from: 'auto_review', to: 'approved' },
        { from: 'auto_review', to: 'manual_review' },
        { from: 'manual_review', to: 'approved' },
        { from: 'manual_review', to: 'rejected' },
        { from: 'rejected', to: 'submitted' },
      ],
    },
  ];
  for (const d of defs) {
    const exists = await db.prepare('SELECT 1 FROM workflow_definitions WHERE wf_key = ? AND version = 1').get(d.key);
    if (!exists) await createDefinition({ ...d, version: 1 });
  }
}
