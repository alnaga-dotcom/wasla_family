import { db } from './db.js';
import { completionFor } from './fields.js';
import { trustLevel } from './trust.js';

export const CARD_KEYS = ['birth_year', 'city', 'profession', 'education', 'religiosity', 'lifestyle', 'nationality', 'governorate', 'country', 'height', 'health', 'photo_done', 'selfie_done'];

export function profileFields(userId) {
  const map = {};
  db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?')
    .all(userId)
    .forEach((r) => { map[r.field_key] = r.value; });
  if (map.birth_year) {
    const by = Number(map.birth_year);
    if (Number.isFinite(by)) map.age = String(new Date().getFullYear() - by);
  }
  return map;
}

// بطاقة عامة آمنة للاكتشاف والبحث — بلا اتصال ولا إحداثيات ولا حساس (Wasla_19/21).
export function publicCard(userId) {
  const u = db.prepare('SELECT id, name, gender, verified_at, deleted_at FROM users WHERE id = ?').get(userId);
  if (!u || u.deleted_at) return null;
  const fields = profileFields(userId);
  const card = { userId: u.id, name: u.name, gender: u.gender, completion: completionFor(fields).pct };
  CARD_KEYS.forEach((k) => {
    if (k === 'health') return; // حساس — لا يُعرض أبدًا في نتائج الاكتشاف/البحث
    if (fields[k] !== undefined) card[k] = fields[k];
  });
  if (fields.age !== undefined) card.age = fields.age; // مشتق من سنة الميلاد — للفلترة فقط
  const avatar = db.prepare("SELECT filename FROM user_photos WHERE user_id = ? AND kind = 'profile' AND status = 'active' AND review_status = 'approved' ORDER BY id DESC LIMIT 1").get(userId);
  card.photo = avatar ? `/api/photos/${avatar.filename}` : null;
  card.hasPhoto = fields.photo_done === '1';
  card.isVerified = !!u.verified_at;
  card.trustLevel = trustLevel(userId);
  return card;
}
