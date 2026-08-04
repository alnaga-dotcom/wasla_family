import { db } from './db.js';

export function updateUserTrustLevel(userId) {
  const level = trustLevel(userId);
  db.prepare('UPDATE users SET trust_level = ? WHERE id = ?').run(level, userId);
  return level;
}

function fields(userId) {
  const map = {};
  db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?')
    .all(userId)
    .forEach((r) => { map[r.field_key] = r.value; });
  return map;
}

// مستويات التوثيق — Wasla_14/16:
// L1: رقم موثّق عبر OTP (تسجيل فعّال)
// L2: تحقق بالسيلفي (selfie_done)
// L3: L2 + صورة + بيانات أساسية مكتملة (مدينة، مهنة، تعليم)
export function trustLevel(userId) {
  const f = fields(userId);
  if (f.selfie_done === '1') {
    if (f.photo_done === '1' && f.city && f.profession && f.education) return 3;
    return 2;
  }
  return 1;
}

export function trustFactors(userId) {
  const f = fields(userId);
  return [
    { key: 'phone', label: 'رقم موثّق', done: true },
    { key: 'selfie', label: 'تحقق بالسيلفي', done: f.selfie_done === '1' },
    { key: 'photo', label: 'صورة شخصية', done: f.photo_done === '1' },
    { key: 'basics', label: 'بيانات أساسية', done: !!(f.city && f.profession && f.education) },
  ];
}
