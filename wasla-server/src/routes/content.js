import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { ah } from '../async-handler.js';
import { apiError } from '../validate.js';
import { adminRequired, permissionRequired } from '../middleware/admin.js';
import { publish } from '../events.js';

const CATEGORIES = ['story', 'announcement', 'thread'];
const FEEDBACK_CATEGORIES = ['suggestion', 'complaint', 'other'];

const publicRouter = Router();
const adminRouter = Router();

function slugify(input, fallback) {
  const base = String(input || '').trim().toLowerCase();
  const slug = base.replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function publicPost(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    body: row.body,
    coverUrl: row.cover_url,
    author: row.author,
    publishedAt: row.published_at,
  };
}

// ---- Public: blog posts ----

// GET /api/public/posts — published posts list
publicRouter.get('/posts', ah(async (req, res) => {
  const rows = await db.prepare(
    `SELECT id, slug, title, category, excerpt, body, cover_url, author, published_at
     FROM posts WHERE status = 'published' ORDER BY published_at DESC, id DESC`
  ).all();
  res.json({ posts: rows.map(publicPost) });
}));

// GET /api/public/posts/:slug — single published post
publicRouter.get('/posts/:slug', ah(async (req, res) => {
  const row = await db.prepare(
    `SELECT id, slug, title, category, excerpt, body, cover_url, author, published_at
     FROM posts WHERE slug = ? AND status = 'published'`
  ).get(req.params.slug);
  if (!row) return apiError(res, 404, 'NOT_FOUND', 'المقال غير موجود');
  res.json({ post: publicPost(row) });
}));

// ---- Public: feedback (suggestions & complaints) ----

// POST /api/public/feedback { name?, contact?, category, message }
publicRouter.post('/feedback', ah(async (req, res) => {
  const { name, contact, category, message } = req.body || {};
  const cat = String(category || 'other').trim();
  if (!FEEDBACK_CATEGORIES.includes(cat)) {
    return apiError(res, 422, 'INVALID_CATEGORY', 'اختر نوع الرسالة', 'category');
  }
  const msg = String(message || '').trim();
  if (msg.length < 10 || msg.length > 5000) {
    return apiError(res, 422, 'INVALID_MESSAGE', 'اكتب رسالتك (١٠ أحرف على الأقل)', 'message');
  }
  const normName = String(name || '').trim().slice(0, 80) || null;
  const normContact = String(contact || '').trim().slice(0, 120) || null;

  const r = await db.prepare(
    'INSERT INTO feedback (name, contact, category, message, user_id) VALUES (?, ?, ?, ?, ?)'
  ).run(normName, normContact, cat, msg, req.userId || null);

  await publish('FeedbackReceived', { name: normName, contact: normContact, category: cat }, 'api', {
    entityType: 'feedback',
    entityId: String(r.lastInsertRowid),
  });

  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
}));

// ---- Admin: blog posts CRUD ----

// GET /admin/posts?status=all|published|draft
adminRouter.get('/posts', permissionRequired('content', 'review'), ah(async (req, res) => {
  const { status } = req.query || {};
  const rows = status && status !== 'all'
    ? await db.prepare(`SELECT * FROM posts WHERE status = ? ORDER BY id DESC`).all(status)
    : await db.prepare(`SELECT * FROM posts ORDER BY id DESC`).all();
  res.json({ posts: rows });
}));

// POST /admin/posts { slug?, title, category, excerpt?, body, cover_url?, author?, status?, published_at? }
adminRouter.post('/posts', permissionRequired('content', 'review'), ah(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (title.length < 3 || title.length > 160) {
    return apiError(res, 422, 'INVALID_TITLE', 'عنوان المقال غير صالح (٣–١٦٠ حرفًا)', 'title');
  }
  const cat = String(b.category || 'announcement').trim();
  if (!CATEGORIES.includes(cat)) {
    return apiError(res, 422, 'INVALID_CATEGORY', 'اختر قسمًا (قصة / إعلان / موضوع)', 'category');
  }
  const body = String(b.body || '').trim();
  if (body.length < 20) {
    return apiError(res, 422, 'INVALID_BODY', 'محتوى المقال قصير جدًا', 'body');
  }
  const status = b.status === 'draft' ? 'draft' : 'published';
  const slug = slugify(b.slug, `post-${Date.now().toString(36)}`);
  const publishedAt = b.published_at || (status === 'published' ? nowIso() : null);

  try {
    const r = await db.prepare(
      `INSERT INTO posts (slug, title, category, excerpt, body, cover_url, author, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(slug, title, cat, String(b.excerpt || '').trim().slice(0, 300) || null, body,
      String(b.cover_url || '').trim() || null, String(b.author || '').trim() || null, status, publishedAt);
    await publish('PostPublished', { id: Number(r.lastInsertRowid), slug, title, category: cat }, 'api', {
      entityType: 'post',
      entityId: String(r.lastInsertRowid),
    });
    res.status(201).json({ ok: true, id: Number(r.lastInsertRowid), slug });
  } catch (err) {
    if (/UNIQUE/.test(String(err.message))) {
      return apiError(res, 409, 'SLUG_TAKEN', 'هذا الرابط مستخدم بالفعل', 'slug');
    }
    throw err;
  }
}));

// PUT /admin/posts/:id
adminRouter.put('/posts/:id', permissionRequired('content', 'review'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!existing) return apiError(res, 404, 'NOT_FOUND', 'المقال غير موجود');

  const b = req.body || {};
  const title = b.title !== undefined ? String(b.title).trim() : existing.title;
  const cat = b.category !== undefined ? String(b.category).trim() : existing.category;
  const body = b.body !== undefined ? String(b.body).trim() : existing.body;
  if (title.length < 3 || title.length > 160) {
    return apiError(res, 422, 'INVALID_TITLE', 'عنوان المقال غير صالح', 'title');
  }
  if (!CATEGORIES.includes(cat)) {
    return apiError(res, 422, 'INVALID_CATEGORY', 'اختر قسمًا (قصة / إعلان / موضوع)', 'category');
  }
  if (body.length < 20) {
    return apiError(res, 422, 'INVALID_BODY', 'محتوى المقال قصير جدًا', 'body');
  }
  const status = b.status === 'draft' ? 'draft' : 'published';
  const slug = slugify(b.slug, existing.slug);
  const publishedAt = b.published_at || (existing.published_at || (status === 'published' ? nowIso() : null));

  try {
    await db.prepare(
      `UPDATE posts SET slug = ?, title = ?, category = ?, excerpt = ?, body = ?, cover_url = ?, author = ?, status = ?, published_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(slug, title, cat, b.excerpt !== undefined ? String(b.excerpt).trim().slice(0, 300) : existing.excerpt,
      body, b.cover_url !== undefined ? String(b.cover_url).trim() : existing.cover_url,
      b.author !== undefined ? String(b.author).trim() : existing.author, status, publishedAt, nowIso(), id);
    res.json({ ok: true });
  } catch (err) {
    if (/UNIQUE/.test(String(err.message))) {
      return apiError(res, 409, 'SLUG_TAKEN', 'هذا الرابط مستخدم بالفعل', 'slug');
    }
    throw err;
  }
}));

// DELETE /admin/posts/:id
adminRouter.delete('/posts/:id', permissionRequired('content', 'review'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!existing) return apiError(res, 404, 'NOT_FOUND', 'المقال غير موجود');
  await db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  res.json({ ok: true });
}));

// ---- Admin: feedback queue ----

// GET /admin/feedback?status=new|open|closed|all
adminRouter.get('/feedback', permissionRequired('queues', 'view'), ah(async (req, res) => {
  const { status } = req.query || {};
  const rows = status && status !== 'all'
    ? await db.prepare(`SELECT * FROM feedback WHERE status = ? ORDER BY created_at DESC LIMIT 300`).all(status)
    : await db.prepare(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT 300`).all();
  res.json({ feedback: rows });
}));

// POST /admin/feedback/:id/status { status }
adminRouter.post('/feedback/:id/status', permissionRequired('queues', 'view'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const status = String((req.body || {}).status || '').trim();
  if (!['new', 'open', 'closed'].includes(status)) {
    return apiError(res, 422, 'INVALID_STATUS', 'حالة غير صالحة', 'status');
  }
  const existing = await db.prepare('SELECT * FROM feedback WHERE id = ?').get(id);
  if (!existing) return apiError(res, 404, 'NOT_FOUND', 'الرسالة غير موجودة');
  await db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
}));

export const contentPublicRouter = publicRouter;
export const contentAdminRouter = adminRouter;
