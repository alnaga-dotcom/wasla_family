import { db, nowIso } from './db.js';

// تقديم طلب توثيق الحساب — Wasla_26
export function requestVerification(userId, type = 'id', note = null) {
  const open = db.prepare(
    "SELECT * FROM verification_requests WHERE user_id = ? AND status = 'pending'"
  ).get(userId);
  if (open) return { duplicate: true, id: open.id };
  const r = db.prepare(
    'INSERT INTO verification_requests (user_id, type, note, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, type, note, 'pending', nowIso());
  return { id: Number(r.lastInsertRowid) };
}

export function myVerificationStatus(userId) {
  const u = db.prepare('SELECT verified_at FROM users WHERE id = ?').get(userId);
  const last = db.prepare(
    'SELECT * FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1'
  ).get(userId);
  return {
    verified: !!u.verified_at,
    verifiedAt: u.verified_at || null,
    request: last
      ? { id: last.id, type: last.type, status: last.status, note: last.note, createdAt: last.created_at }
      : null,
  };
}

export function listVerificationRequests(status = 'pending') {
  return db.prepare(
    `SELECT v.*, u.name AS user_name, u.phone AS user_phone
     FROM verification_requests v JOIN users u ON u.id = v.user_id
     WHERE (? IS NULL OR v.status = ?)
     ORDER BY v.id DESC LIMIT 200`
  ).all(status === 'all' ? null : status, status === 'all' ? null : status);
}

// القرار: approve أو reject — يعيّن شارة التوثيق عند القبول — Wasla_26
export function decideVerification(requestId, approve, reviewerId, reason = null) {
  const req = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(requestId);
  if (!req || req.status !== 'pending') return null;
  const status = approve ? 'approved' : 'rejected';
  db.prepare(
    "UPDATE verification_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, note = COALESCE(?, note) WHERE id = ?"
  ).run(status, reviewerId, nowIso(), reason, requestId);
  if (approve) {
    db.prepare('UPDATE users SET verified_at = ? WHERE id = ?').run(nowIso(), req.user_id);
  } else {
    db.prepare('UPDATE users SET verified_at = NULL WHERE id = ?').run(req.user_id);
  }
  return { requestId: requestId, userId: req.user_id, status };
}
