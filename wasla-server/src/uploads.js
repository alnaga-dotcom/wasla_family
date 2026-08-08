import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { db, nowIso } from './db.js';
import { config } from './config.js';

mkdirSync(config.uploadsDir, { recursive: true });

const ALLOWED = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export function getAllowedMime(ext) {
  return ALLOWED[ext.toLowerCase()];
}

export function isAllowedFile(mime) {
  return Object.values(ALLOWED).includes(mime);
}

export function getMaxSize() {
  return MAX_SIZE;
}

export async function storePhoto(userId, kind, file) {
  if (!file || !file.buffer) throw new Error('missing file');
  const ext = extname(file.originalname || '').toLowerCase();
  const mime = file.mimetype;
  if (!getAllowedMime(ext) || getAllowedMime(ext) !== mime) {
    return { ok: false, code: 'INVALID_FILE_TYPE', allowed: Object.keys(ALLOWED) };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, code: 'FILE_TOO_LARGE', maxBytes: MAX_SIZE };
  }

  const name = `${kind}_${randomBytes(16).toString('hex')}${ext}`;
  const path = join(config.uploadsDir, name);
  try {
    writeFileSync(path, file.buffer);
  } catch (e) {
    return { ok: false, code: 'WRITE_FAILED', detail: e.message };
  }

  if (kind === 'private') {
    // Private gallery (match-only): max 6 photos, always stored as-is (no public moderation queue).
    const count = (await db.prepare("SELECT COUNT(*) AS c FROM user_photos WHERE user_id = ? AND kind = 'private' AND status = 'active'").get(userId)).c;
    if (count >= 6) {
      try { unlinkSync(path); } catch {}
      return { ok: false, code: 'PRIVATE_LIMIT_REACHED', maxPrivate: 6, detail: 'الحد الأقصى ٦ صور خاصة' };
    }
    const r = await db.prepare(
      `INSERT INTO user_photos (user_id, kind, filename, original_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, kind, name, file.originalname || name, mime, file.size);
    return { ok: true, id: Number(r.lastInsertRowid), filename: name, path, pending: false };
  }

  if (kind === 'profile') {
    // Avatar moderation: new upload goes to review; only ONE pending at a time,
    // and the current approved avatar stays visible until the new one is approved.
    await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE user_id = ? AND kind = 'profile' AND review_status = 'pending'").run(userId);
    const r = await db.prepare(
      `INSERT INTO user_photos (user_id, kind, filename, original_name, mime_type, size_bytes, review_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(userId, kind, name, file.originalname || name, mime, file.size);
    return { ok: true, id: Number(r.lastInsertRowid), filename: name, path, pending: true };
  }

  // Selfie: unchanged — private, no moderation queue.
  await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE user_id = ? AND kind = ? AND status = 'active'").run(userId, kind);
  const r = await db.prepare(
    `INSERT INTO user_photos (user_id, kind, filename, original_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, kind, name, file.originalname || name, mime, file.size);
  return { ok: true, id: Number(r.lastInsertRowid), filename: name, path, pending: false };
}

export async function getPhotoById(id) {
  return db.prepare('SELECT * FROM user_photos WHERE id = ? AND status = ?').get(id, 'active');
}

export async function getPhotoByIdRaw(id) {
  return db.prepare('SELECT * FROM user_photos WHERE id = ?').get(id);
}

export async function getPhotoByFilename(filename) {
  return db.prepare('SELECT * FROM user_photos WHERE filename = ? AND status = ?').get(filename, 'active');
}

export async function getUserActivePhoto(userId, kind) {
  return db.prepare('SELECT * FROM user_photos WHERE user_id = ? AND kind = ? AND status = ? ORDER BY id DESC LIMIT 1').get(userId, kind, 'active');
}

export async function getUserPrivatePhotos(userId) {
  return db.prepare("SELECT * FROM user_photos WHERE user_id = ? AND kind = 'private' AND status = 'active' ORDER BY id DESC").all(userId);
}

// True only when both users have liked each other (mutual match). Used to gate private photos.
export async function isMutualMatch(a, b) {
  const rows = await db.prepare(
    `SELECT action FROM match_actions WHERE (actor_id = ? AND target_id = ?) OR (actor_id = ? AND target_id = ?)`
  ).all(a, b, b, a);
  return rows.length === 2 && rows.every((r) => r.action === 'like');
}

// Latest photo of a kind regardless of review state — used so the owner can see their pending avatar.
export async function getLatestPhoto(userId, kind) {
  return db.prepare('SELECT * FROM user_photos WHERE user_id = ? AND kind = ? AND status = ? ORDER BY id DESC LIMIT 1').get(userId, kind, 'active');
}

export async function getPendingPhotos(status = 'pending', limit = 200) {
  return db.prepare(
    `SELECT p.*, u.name AS user_name, u.phone AS user_phone
     FROM user_photos p JOIN users u ON u.id = p.user_id
     WHERE p.review_status = ?
     ORDER BY p.id DESC LIMIT ?`
  ).all(status, limit);
}

export async function approvePhoto(photoId, adminId) {
  const photo = await getPhotoByIdRaw(photoId);
  if (!photo || photo.review_status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  // Exactly one approved avatar: retire the previously approved one.
  await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE user_id = ? AND kind = ? AND review_status = 'approved'").run(photo.user_id, photo.kind);
  await db.prepare(`UPDATE user_photos SET review_status = 'approved', reviewed_by = ?, reviewed_at = ?, review_reason = NULL WHERE id = ?`)
    .run(adminId || null, nowIso(), photoId);
  if (photo.kind === 'profile') await markProfilePhotoDone(photo.user_id);
  return { ok: true, userId: photo.user_id, kind: photo.kind };
}

export async function rejectPhoto(photoId, adminId, reason) {
  const photo = await getPhotoByIdRaw(photoId);
  if (!photo || photo.review_status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  await db.prepare(`UPDATE user_photos SET status = 'deleted', review_status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_reason = ? WHERE id = ?`)
    .run(adminId || null, nowIso(), String(reason || '').slice(0, 500) || null, photoId);
  try { unlinkSync(join(config.uploadsDir, photo.filename)); } catch {}
  return { ok: true, userId: photo.user_id, kind: photo.kind };
}

// Future AI image filter seam: swap this stub for a vision API (NSFW/quality) later.
// Verdict: 'approve' | 'reject' | 'review'. 'review' routes to the human queue.
export async function evaluateImage(file) {
  return { verdict: 'review', score: 0, reasons: [] };
}

export function readPhotoFile(filename) {
  const path = join(config.uploadsDir, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export async function deletePhoto(userId, kind) {
  const photo = await getUserActivePhoto(userId, kind);
  if (photo) {
    await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE id = ?").run(photo.id);
    try { unlinkSync(join(config.uploadsDir, photo.filename)); } catch {}
  }
  const pending = await db.prepare("SELECT * FROM user_photos WHERE user_id = ? AND kind = ? AND status = 'active' AND review_status = 'pending' ORDER BY id DESC LIMIT 1").get(userId, kind);
  if (pending) {
    await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE id = ?").run(pending.id);
    try { unlinkSync(join(config.uploadsDir, pending.filename)); } catch {}
  }
  return { ok: true };
}

export async function deletePrivatePhoto(userId, photoId) {
  const photo = await db.prepare("SELECT * FROM user_photos WHERE id = ? AND user_id = ? AND kind = 'private'").get(photoId, userId);
  if (!photo) return { ok: false, code: 'NOT_FOUND' };
  await db.prepare("UPDATE user_photos SET status = 'deleted' WHERE id = ?").run(photo.id);
  try { unlinkSync(join(config.uploadsDir, photo.filename)); } catch {}
  return { ok: true };
}

export async function canViewPhoto(photo, viewerId, viewerRole) {
  if (!photo || photo.status !== 'active') return false;
  const isStaff = viewerRole === 'admin' || viewerRole === 'super_admin';
  if (isStaff) return true;
  if (photo.user_id === viewerId) return true;
  // Private photos (real, match-only gallery): visible only on mutual like.
  if (photo.kind === 'private') {
    return isMutualMatch(photo.user_id, viewerId);
  }
  // Pending avatars are not visible to anyone but the owner/admins until approved.
  if (photo.review_status !== 'approved') return false;
  // Selfie is private to owner/admin.
  if (photo.kind === 'selfie') return false;
  return true;
}

export function photoUrl(photo) {
  return `/api/photos/${photo.filename}`;
}

export async function markProfilePhotoDone(userId) {
  const spec = { domain: 'Verification', tier: 1, weight: 10, type: 'flag' };
  await db.prepare(
    `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
     VALUES (?, 'photo_done', '1', ?, 0, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
  ).run(userId, spec.domain, new Date().toISOString().slice(0, 19));
}

export async function markSelfieDone(userId) {
  const spec = { domain: 'Verification', tier: 1, weight: 15, type: 'flag' };
  await db.prepare(
    `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
     VALUES (?, 'selfie_done', '1', ?, 0, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
  ).run(userId, spec.domain, new Date().toISOString().slice(0, 19));
}

export async function clearProfilePhotoDone(userId) {
  await db.prepare("DELETE FROM profile_fields WHERE user_id = ? AND field_key = 'photo_done'").run(userId);
}

export async function clearSelfieDone(userId) {
  await db.prepare("DELETE FROM profile_fields WHERE user_id = ? AND field_key = 'selfie_done'").run(userId);
}
