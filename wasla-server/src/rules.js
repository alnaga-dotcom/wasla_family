import { db } from './db.js';
import { publish } from './events.js';

const OPERATORS = {
  equals: (a, b) => a == b,
  not_equals: (a, b) => a != b,
  gt: (a, b) => Number(a) > Number(b),
  lt: (a, b) => Number(a) < Number(b),
  between: (a, b) => Array.isArray(b) && Number(a) >= Number(b[0]) && Number(a) <= Number(b[1]),
  in_list: (a, b) => Array.isArray(b) && b.includes(a),
  contains: (a, b) => String(a || '').toLowerCase().includes(String(b).toLowerCase()),
  exists: (a) => a !== undefined && a !== null && a !== '',
  is_empty: (a) => a === undefined || a === null || a === '',
};

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

function evaluateCondition(cond, context) {
  const value = resolvePath(context, cond.field);
  const op = OPERATORS[cond.operator];
  if (!op) return false;
  return op(value, cond.value);
}

function evaluateConditions(rule, context) {
  const groups = rule.conditions || [];
  if (!groups.length) return true;
  // groups is array of OR groups; each group is { all: [...] } or { any: [...] }
  return groups.some((group) => {
    if (group.all) return group.all.every((c) => evaluateCondition(c, context));
    if (group.any) return group.any.some((c) => evaluateCondition(c, context));
    return false;
  });
}

export async function evaluateRules(eventType, context) {
  const rules = await db.prepare("SELECT * FROM rules WHERE event_type = ? AND status = 'active' ORDER BY priority DESC, id ASC").all(eventType);
  const results = [];
  for (const rule of rules) {
    let conditions = [];
    let actions = [];
    try {
      conditions = JSON.parse(rule.conditions);
      actions = JSON.parse(rule.actions);
    } catch { continue; }
    const matched = evaluateConditions({ conditions }, context);
    const result = { ruleId: rule.id, name: rule.name, matched, actions: [] };
    if (matched) {
      for (const action of actions) {
        if (action.type === 'emit_event') {
          await publish(action.eventType, action.payload || {}, 'rule', { userId: context.userId, entityType: context.entityType, entityId: context.entityId });
        }
      }
      result.actions = actions;
    }
    await db.prepare(
      `INSERT INTO rule_executions (rule_id, event_id, context, result) VALUES (?, ?, ?, ?)`
    ).run(rule.id, context.eventId || null, JSON.stringify(context), JSON.stringify(result));
    results.push(result);
  }
  return results;
}

export async function createRule({ name, description, eventType, conditions, actions, priority = 0, status = 'active', userMessage, sensitive = false }) {
  const r = await db.prepare(
    `INSERT INTO rules (name, description, event_type, conditions, actions, priority, status, user_message, sensitive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, description || null, eventType, JSON.stringify(conditions), JSON.stringify(actions), priority, status, userMessage || null, sensitive ? 1 : 0);
  return Number(r.lastInsertRowid);
}

export async function updateRule(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'conditions' || k === 'actions') {
      sets.push(`${k} = ?`);
      params.push(JSON.stringify(v));
    } else if (k === 'sensitive') {
      sets.push(`${k} = ?`);
      params.push(v ? 1 : 0);
    } else {
      sets.push(`${k} = ?`);
      params.push(v);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await db.prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export async function listRules({ eventType, status } = {}) {
  let sql = 'SELECT * FROM rules WHERE 1=1';
  const params = [];
  if (eventType) { sql += ' AND event_type = ?'; params.push(eventType); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY priority DESC, id ASC';
  return db.prepare(sql).all(...params);
}

export async function getRule(id) {
  return db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
}

export async function testRule(id, context) {
  const rule = await getRule(id);
  if (!rule) return null;
  const conditions = JSON.parse(rule.conditions);
  const matched = evaluateConditions({ conditions }, context);
  return { ruleId: rule.id, name: rule.name, matched, conditions, actions: JSON.parse(rule.actions) };
}
