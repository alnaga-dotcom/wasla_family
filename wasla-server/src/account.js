import { db, nowIso } from './db.js';

// مهلة حذف الحساب (أيام) — قابلة للتخصيص عبر البيئة، افتراضيًا 30 (Wasla_22)
export const DELETE_GRACE_DAYS = Number(process.env.WASLA_DELETE_GRACE_DAYS || 30);

export function deleteGraceMs() {
  return DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

export function restoreBy(deletedAt) {
  if (!deletedAt) return null;
  const d = new Date(deletedAt.replace(' ', 'T'));
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function isDeleted(user) {
  return !!(user && user.deleted_at);
}

export function isInGrace(deletedAt) {
  if (!deletedAt) return false;
  return new Date(deletedAt.replace(' ', 'T')) > new Date();
}

// حذف حقيقي كامل لسجلات المستخدم (بعد انتهاء المهلة)
export function purgeUser(userId) {
  const t = db;
  t.exec('BEGIN');
  try {
    t.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    t.prepare('DELETE FROM otp_codes WHERE user_id = ?').run(userId);
    t.prepare('DELETE FROM profile_fields WHERE user_id = ?').run(userId);
    t.prepare('DELETE FROM discovery_views WHERE actor_id = ? OR target_id = ?').run(userId, userId);
    t.prepare('DELETE FROM match_actions WHERE actor_id = ? OR target_id = ?').run(userId, userId);
    t.prepare('DELETE FROM archived_matches WHERE user_id = ? OR other_id = ?').run(userId, userId);
    t.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(userId, userId);
    t.prepare('DELETE FROM blocked_members WHERE user_id = ? OR blocked_id = ?').run(userId, userId);
    t.prepare('DELETE FROM reports WHERE reporter_id = ? OR reported_id = ?').run(userId, userId);
    t.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
    t.prepare('DELETE FROM notifications WHERE user_id = ? OR from_user_id = ?').run(userId, userId);
    t.prepare('DELETE FROM favorites WHERE user_id = ? OR favorite_id = ?').run(userId, userId);
    t.prepare('DELETE FROM users WHERE id = ?').run(userId);
    t.exec('COMMIT');
  } catch (e) {
    t.exec('ROLLBACK');
    throw e;
  }
}

// تطهير الحسابات المنتهية مهلة حذفها
export function purgeExpired() {
  const rows = db.prepare('SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at <= ?').all(nowIso());
  rows.forEach((r) => purgeUser(r.id));
  return rows.length;
}

// تصدير بيانات المستخدم (كل ما يملكه — لحق الاطلاع/النقل)
export function exportData(userId) {
  const u = db.prepare('SELECT id, name, phone, gender, status, created_at FROM users WHERE id = ?').get(userId);
  if (!u) return null;
  const fields = {};
  db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId)
    .forEach((r) => { fields[r.field_key] = r.value; });
  const settings = db.prepare('SELECT photo_visibility, last_seen_on, paused FROM user_settings WHERE user_id = ?').get(userId) || null;
  const favorites = db.prepare('SELECT favorite_id FROM favorites WHERE user_id = ?').all(userId).map((r) => r.favorite_id);
  const matches = db.prepare(
    `SELECT target_id FROM match_actions WHERE actor_id = ? AND action = 'like'
     AND EXISTS (SELECT 1 FROM match_actions m2 WHERE m2.actor_id = target_id AND m2.target_id = ? AND m2.action = 'like')`
  ).all(userId, userId).map((r) => r.target_id);
  const conversations = db.prepare(
    `SELECT sender_id, receiver_id, kind, created_at FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY id`
  ).all(userId, userId).map((r) => ({
    with: r.sender_id === userId ? r.receiver_id : r.sender_id,
    direction: r.sender_id === userId ? 'sent' : 'received',
    kind: r.kind,
    at: r.created_at,
  }));
  const blocked = db.prepare('SELECT blocked_id FROM blocked_members WHERE user_id = ?').all(userId).map((r) => r.blocked_id);
  const reports = db.prepare('SELECT id, reported_id, reason, status, created_at FROM reports WHERE reporter_id = ?').all(userId);
  const notifications = db.prepare('SELECT id, type, text, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC').all(userId);
  return {
    exportedAt: nowIso(),
    user: u,
    profile: fields,
    settings,
    favorites,
    mutualMatches: matches,
    messageCount: conversations.length,
    conversations,
    blocked,
    reports,
    notifications,
  };
}
