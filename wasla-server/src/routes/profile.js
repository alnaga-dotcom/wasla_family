import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { FIELD_SPECS, completionFor, isValidFieldValue } from '../fields.js';
import { checkField } from '../moderation.js';
import { publish } from '../events.js';
import { getUserActivePhoto, photoUrl } from '../uploads.js';
import { updateUserTrustLevel } from '../trust.js';

const router = Router();
router.use(authRequired);

function fieldsFor(userId) {
  const rows = db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const map = {};
  rows.forEach((r) => { map[r.field_key] = r.value; });
  return map;
}

// GET /api/profile/me  — own profile, includes completion and photos (Wasla_05 §9e)
router.get('/me', (req, res) => {
  const fields = fieldsFor(req.userId);
  const u = db.prepare('SELECT id, name, phone, gender, status, role, trust_level, created_at FROM users WHERE id = ?').get(req.userId);
  const profilePhoto = getUserActivePhoto(req.userId, 'profile');
  const selfiePhoto = getUserActivePhoto(req.userId, 'selfie');
  res.json({
    user: {
      id: u.id,
      name: u.name,
      phone: u.phone,
      gender: u.gender,
      status: u.status,
      role: u.role,
      trustLevel: u.trust_level,
      createdAt: u.created_at,
    },
    fields,
    completion: completionFor(fields),
    photos: {
      profile: profilePhoto ? { id: profilePhoto.id, url: photoUrl(profilePhoto) } : null,
      selfie: selfiePhoto ? { id: selfiePhoto.id, url: photoUrl(selfiePhoto) } : null,
    },
  });
});

// GET /api/profile/completion
router.get('/completion', (req, res) => {
  const fields = fieldsFor(req.userId);
  res.json({ completion: completionFor(fields) });
});

// PATCH /api/profile/me  { field_key, value } | { fields: [{field_key, value}] }
router.patch('/me', (req, res) => {
  const body = req.body || {};
  const updates = Array.isArray(body.fields) ? body.fields : body.field_key ? [{ field_key: body.field_key, value: body.value }] : [];
  if (updates.length === 0) return apiError(res, 422, 'MISSING_FIELDS', 'لا توجد حقول للتحديث');

  for (const { field_key, value } of updates) {
    const spec = FIELD_SPECS[field_key];
    if (!spec) return apiError(res, 422, 'UNKNOWN_FIELD', 'حقل غير معروف', 'field_key');
    const check = isValidFieldValue(field_key, value);
    if (!check.ok) return apiError(res, 422, 'INVALID_VALUE', 'قيمة غير صالحة لهذا الحقل', 'field_key');
    // Content moderation for text fields (Wasla_15)
    if (spec.type === 'text') {
      const mod = checkField(req.userId, field_key, check.value);
      if (!mod.allowed) {
        return apiError(res, 422, 'MODERATION_REJECT', 'لحماية خصوصية الجميع، لا يُسمح بإضافة وسائل تواصل أو روابط أو بيانات اتصال. الرجاء تعديل النص.', 'value', { violations: mod.violations });
      }
    }
    const sensitive = spec.sensitive ? 1 : 0;
    db.prepare(
      `INSERT INTO profile_fields (user_id, field_key, value, domain, sensitive, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, field_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(req.userId, field_key, check.value, spec.domain, sensitive, nowIso());
    publish('ProfileUpdated', { field_key, value: check.value }, 'api', { userId: req.userId, entityType: 'profile', entityId: String(req.userId) });
  }

  const fields = fieldsFor(req.userId);
  const completion = completionFor(fields);
  const trustLevel = updateUserTrustLevel(req.userId);
  if (completion.pct >= 100) {
    publish('ProfileCompleted', { completion }, 'api', { userId: req.userId, entityType: 'profile', entityId: String(req.userId) });
  }
  res.json({ fields, completion, trustLevel });
});

export default router;
