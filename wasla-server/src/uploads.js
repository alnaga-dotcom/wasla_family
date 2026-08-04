import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
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

export function storePhoto(userId, kind, file) {
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
    // Optional: simple dimension check for images
    writeFileSync(path, file.buffer);
  } catch (e) {
    return { ok: false, code: 'WRITE_FAILED', detail: e.message };
  }

  // Mark any previous same-kind photo as deleted
  db.prepare("UPDATE user_photos SET status = 'deleted' WHERE user_id = ? AND kind = ? AND status = 'active'").run(userId, kind);

  const r = db.prepare(
    `INSERT INTO user_photos (user_id, kind, filename, original_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, kind, name, file.originalname || name, mime, file.size);

  return { ok: true, id: Number(r.lastInsertRowid), filename: name, path };
}

export function getPhotoById(id) {
  return db.prepare('SELECT * FROM user_photos WHERE id = ? AND status = ?').get(id, 'active');
}

export function getPhotoByFilename(filename) {
  return db.prepare('SELECT * FROM user_photos WHERE filename = ? AND status = ?').get(filename, 'active');
}

export function getUserActivePhoto(userId, kind) {
  return db.prepare('SELECT * FROM user_photos WHERE user_id = ? AND kind = ? AND status = ? ORDER BY id DESC LIMIT 1').get(userId, kind, 'active');
}

export function readPhotoFile(filename) {
  const path = join(config.uploadsDir, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function deletePhoto(userId, kind) {
  const photo = getUserActivePhoto(userId, kind);
  if (!photo) return { ok: false, code: 'NOT_FOUND' };
  db.prepare("UPDATE user_photos SET status = 'deleted' WHERE id = ?").run(photo.id);
  try { unlinkSync(join(config.uploadsDir, photo.filename)); } catch {}
  return { ok: true };
}

export function canViewPhoto(photo, viewerId, viewerRole) {
  if (!photo || photo.status !== 'active') return false;
  if (viewerRole === 'admin' || viewerRole === 'super_admin') return true;
  if (photo.user_id === viewerId) return true;
  // Profile photos: visible inside platform to active users; selfie is private to owner/admin.
  if (photo.kind === 'selfie') return false;
  return true;
}

export function photoUrl(photo) {
  return `/api/photos/${photo.filename}`;
}

export function markProfilePhotoDone(userId) {
  const spec = { domain: 'Verification', tier: 1, weight: 10, type: 'flag' };
  db.prepare(
    `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
     VALUES (?, 'photo_done', '1', ?, 0, ?)
     ON CONFLICT(user_id, field_key) DO UPDATE SET value = '1', updated_at = excluded.updated_at`
  ).run(userId, spec.domain, new Date().toISOString().slice(0, 19));
}

export function markSelfieDone(userId) {
  const spec = { domain: 'Verification', tier: 1, weight: 15, type: 'flag' };
  db.prepare(
    `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
     VALUES (?, 'selfie_done', '1', ?, 0, ?)
     ON CONFLICT(user_id, field_key) DO UPDATE SET value = '1', updated_at = excluded.updated_at`
  ).run(userId, spec.domain, new Date().toISOString().slice(0, 19));
}

export function clearProfilePhotoDone(userId) {
  db.prepare("DELETE FROM profile_fields WHERE user_id = ? AND field_key = 'photo_done'").run(userId);
}

export function clearSelfieDone(userId) {
  db.prepare("DELETE FROM profile_fields WHERE user_id = ? AND field_key = 'selfie_done'").run(userId);
}
