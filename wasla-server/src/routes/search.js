import { Router } from 'express';
import { db } from '../db.js';
import { ah } from '../async-handler.js';
import { authRequired, emailVerifiedRequired } from '../middleware/auth.js';
import { publicCard } from '../cards.js';
import { FIELD_SPECS } from '../fields.js';

const router = Router();

const SEARCHABLE = ['city', 'governorate', 'education', 'religiosity', 'lifestyle', 'profession', 'nationality'];

// GET /api/search?q=&city=&education=&religiosity=&lifestyle=&profession=&nationality=&ageMin=&ageMax=&heightMin=&heightMax=&page=&limit=
router.get('/search', authRequired, emailVerifiedRequired, ah(async (req, res) => {
  const me = req.userId;
  const q = String(req.query.q || '').trim();
  const city = String(req.query.city || '').trim();
  const education = String(req.query.education || '').trim();
  const religiosity = String(req.query.religiosity || '').trim();
  const lifestyle = String(req.query.lifestyle || '').trim();
  const profession = String(req.query.profession || '').trim();
  const nationality = String(req.query.nationality || '').trim();
  const ageMin = Number(req.query.ageMin);
  const ageMax = Number(req.query.ageMax);
  const heightMin = Number(req.query.heightMin);
  const heightMax = Number(req.query.heightMax);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));

  const params = [me, me, me];
  let where = '';
  if (q) {
    where += ` AND lower(u.name) LIKE lower(?)`;
    params.push(`%${q}%`);
  }
  function addFilter(key, value) {
    if (!value) return;
    where += ` AND EXISTS (SELECT 1 FROM profile_fields f_${key} WHERE f_${key}.user_id = u.id AND f_${key}.field_key = ? AND f_${key}.value = ?)`;
    params.push(key, value);
  }
  addFilter('city', city);
  addFilter('education', education);
  addFilter('religiosity', religiosity);
  addFilter('lifestyle', lifestyle);
  addFilter('profession', profession);
  addFilter('nationality', nationality);

  const rows = await db.prepare(
    `SELECT u.id FROM users u
     WHERE u.id != ?
       AND u.status = 'active' AND u.deleted_at IS NULL
       AND COALESCE((SELECT paused FROM user_settings s WHERE s.user_id = u.id), 0) = 0
       AND EXISTS (SELECT 1 FROM profile_fields pf WHERE pf.user_id = u.id AND pf.field_key = 'selfie_done' AND pf.value = '1')
       AND NOT EXISTS (SELECT 1 FROM blocked_members bl WHERE bl.user_id = ? AND bl.blocked_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM blocked_members bl2 WHERE bl2.user_id = u.id AND bl2.blocked_id = ?)
       ${where}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?`
  ).all(...params, limit, (page - 1) * limit);

  const cards = await Promise.all(rows.map((r) => publicCard(r.id)));
  const items = cards.filter(Boolean).filter((card) => {
    if (Number.isFinite(ageMin) || Number.isFinite(ageMax)) {
      const age = Number(card.age);
      if (!Number.isFinite(age)) return false;
      if (Number.isFinite(ageMin) && age < ageMin) return false;
      if (Number.isFinite(ageMax) && age > ageMax) return false;
    }
    if (Number.isFinite(heightMin) || Number.isFinite(heightMax)) {
      const height = Number(card.height);
      if (!Number.isFinite(height)) return false;
      if (Number.isFinite(heightMin) && height < heightMin) return false;
      if (Number.isFinite(heightMax) && height > heightMax) return false;
    }
    return true;
  });

  const nextCursor = items.length === limit ? page + 1 : null;
  res.json({ items, page, nextCursor });
}));

// GET /api/search/filters — خيارات قابلة للبحث فقط (Wasla_19/08)
router.get('/search/filters', authRequired, (req, res) => {
  const filters = {};
  SEARCHABLE.forEach((k) => {
    const spec = FIELD_SPECS[k];
    if (spec && spec.values) filters[k] = spec.values;
  });
  res.json({ filters });
});

export default router;
