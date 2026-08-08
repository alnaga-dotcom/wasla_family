import { db, nowIso } from './db.js';
import { randomBytes } from 'node:crypto';

const VERSION = '1.0';
const handlers = new Map();

export function subscribe(eventType, handler) {
  if (!handlers.has(eventType)) handlers.set(eventType, []);
  handlers.get(eventType).push(handler);
}

export function unsubscribe(eventType, handler) {
  const list = handlers.get(eventType) || [];
  handlers.set(eventType, list.filter((h) => h !== handler));
}

export async function publish(type, payload = {}, source = 'api', { userId = null, entityType = null, entityId = null, correlationId = null } = {}) {
  const eventId = 'evt_' + randomBytes(12).toString('hex');
  const now = nowIso();
  await db.prepare(
    `INSERT INTO events (event_id, type, version, source, user_id, entity_type, entity_id, correlation_id, payload, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(eventId, type, VERSION, source, userId, entityType, entityId, correlationId, JSON.stringify(payload), now);

  // Dispatch synchronously to in-process handlers
  const event = { eventId, type, version: VERSION, source, userId, entityType, entityId, correlationId, payload, publishedAt: now };
  const list = handlers.get(type) || [];
  for (const h of list) {
    try { h(event); } catch (e) { console.error('Event handler error', type, e); }
  }
  // also dispatch to wildcard handlers
  const wild = handlers.get('*') || [];
  for (const h of wild) {
    try { h(event); } catch (e) { console.error('Wildcard handler error', e); }
  }
  return eventId;
}

export async function listEvents({ type, entityType, entityId, limit = 100 } = {}) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
  if (entityId) { sql += ' AND entity_id = ?'; params.push(entityId); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(String(limit));
  const rows = await db.prepare(sql).all(...params);
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload || '{}') }));
}

export async function eventTypes() {
  const rows = await db.prepare('SELECT DISTINCT type FROM events ORDER BY type').all();
  return rows.map((r) => r.type);
}

export async function markProcessed(eventId) {
  await db.prepare('UPDATE events SET processed_at = ? WHERE event_id = ?').run(nowIso(), eventId);
}

export function publishEventForRoute(type, req, payload = {}, entityType = null, entityId = null) {
  return publish(type, payload, 'api', { userId: req.userId || null, entityType, entityId });
}
