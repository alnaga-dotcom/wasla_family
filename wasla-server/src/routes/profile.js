import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { apiError } from '../validate.js';
import { authRequired } from '../middleware/auth.js';
import { FIELD_SPECS, completionFor, isValidFieldValue } from '../fields.js';
import { checkField } from '../moderation.js';
import { publish } from '../events.js';
import { getUserActivePhoto, getUserPrivatePhotos, photoUrl } from '../uploads.js';
import { updateUserTrustLevel } from '../trust.js';
import { ah } from '../async-handler.js';

const router = Router();
router.use(authRequired);

async function fieldsFor(userId) {
  const rows = await db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const map = {};
  rows.forEach((r) => { map[r.field_key] = r.value; });
  return map;
}

// GET /api/profile/me  — own profile, includes completion and photos (Wasla_05 §9e)
router.get('/me', ah(async (req, res) => {
  const fields = await fieldsFor(req.userId);
  const u = await db.prepare('SELECT id, name, phone, email, email_verified_at, gender, status, role, trust_level, created_at FROM users WHERE id = ?').get(req.userId);
  const profilePhoto = await getUserActivePhoto(req.userId, 'profile');
  const selfiePhoto = await getUserActivePhoto(req.userId, 'selfie');
  const privatePhotos = await getUserPrivatePhotos(req.userId);
  res.json({
    user: {
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      emailVerified: !!u.email_verified_at,
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
      private: privatePhotos.map((p) => ({ id: p.id, url: photoUrl(p) })),
    },
  });
}));

// GET /api/profile/completion
router.get('/completion', ah(async (req, res) => {
  const fields = await fieldsFor(req.userId);
  res.json({ completion: completionFor(fields) });
}));

// PATCH /api/profile/me  { field_key, value } | { fields: [{field_key, value}] }
router.patch('/me', ah(async (req, res) => {
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
      const mod = await checkField(req.userId, field_key, check.value);
      if (!mod.allowed) {
        const bad = (mod.violations || []).some((v) => v.type === 'profanity');
        return apiError(res, 422, 'MODERATION_REJECT', bad ? 'النص يحتوي على كلمات غير لائقة. الرجاء تعديله.' : 'لحماية خصوصية الجميع، لا يُسمح بإضافة وسائل تواصل أو روابط أو بيانات اتصال. الرجاء تعديل النص.', 'value', { violations: mod.violations });
      }
    }
    const sensitive = spec.sensitive ? 1 : 0;
    await db.prepare(
      `INSERT INTO profile_fields (user_id, field_key, value, domain, \`sensitive\`, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
    ).run(req.userId, field_key, check.value, spec.domain, sensitive, nowIso());
    await publish('ProfileUpdated', { field_key, value: check.value }, 'api', { userId: req.userId, entityType: 'profile', entityId: String(req.userId) });
  }

  const fields = await fieldsFor(req.userId);
  const completion = completionFor(fields);
  const trustLevel = await updateUserTrustLevel(req.userId);
  if (completion.pct >= 100) {
    await publish('ProfileCompleted', { completion }, 'api', { userId: req.userId, entityType: 'profile', entityId: String(req.userId) });
  }
  res.json({ fields, completion, trustLevel });
}));

export default router;
