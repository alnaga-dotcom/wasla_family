import { db } from './db.js';
import { completionFor } from './fields.js';
import { trustLevel } from './trust.js';

export const CARD_KEYS = ['age', 'city', 'profession', 'education', 'religiosity', 'lifestyle', 'nationality', 'height', 'health', 'photo_done', 'selfie_done'];

export function profileFields(userId) {
  const map = {};
  db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?')
    .all(userId)
    .forEach((r) => { map[r.field_key] = r.value; });
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
  card.hasPhoto = fields.photo_done === '1';
  card.isVerified = !!u.verified_at;
  card.trustLevel = trustLevel(userId);
  return card;
}
