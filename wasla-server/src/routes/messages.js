import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { ah } from '../async-handler.js';
import { apiError } from '../validate.js';
import { authRequired, emailVerifiedRequired } from '../middleware/auth.js';
import { publicCard } from '../cards.js';
import { notify } from '../notify.js';
import { canSendMessage, useMessage, isIncomingConversation } from '../subscription.js';
import { checkMessage } from '../moderation.js';
import { publish } from '../events.js';
import { pushToUser } from '../realtime.js';

const router = Router();

async function areMutual(a, b) {
  const rows = await db.prepare(
    `SELECT action FROM match_actions
     WHERE (actor_id = ? AND target_id = ? AND action = 'like')
        OR (actor_id = ? AND target_id = ? AND action = 'like')`
  ).all(a, b, b, a);
  return rows.length === 2;
}

async function userBlocked(me, other) {
  const row = await db.prepare('SELECT 1 FROM blocked_members WHERE user_id = ? AND blocked_id = ?').get(me, other);
  return !!row;
}

async function pubUser(id) {
  return db.prepare('SELECT id, name, gender FROM users WHERE id = ?').get(id);
}

// GET /api/conversations — mutual matches only (Wasla_18 gate)
router.get('/conversations', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const rows = await db.prepare(
    `SELECT a.target_id AS other_id
     FROM match_actions a
     WHERE a.actor_id = ? AND a.action = 'like'
       AND EXISTS (SELECT 1 FROM match_actions b WHERE b.actor_id = a.target_id AND b.target_id = ? AND b.action = 'like')
       AND NOT EXISTS (SELECT 1 FROM archived_matches ar WHERE ar.user_id = ? AND ar.other_id = a.target_id)`
  ).all(me, me, me);

  const conversations = (await Promise.all(rows.map(async (r) => {
    const other = r.other_id;
    const card = await publicCard(other);
    if (!card) return null;
    const last = await db.prepare(
      `SELECT id, sender_id, text, kind, is_read, created_at FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY id DESC LIMIT 1`
    ).get(me, other, other, me);
    const unreadRow = await db.prepare(
      `SELECT COUNT(*) AS c FROM messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`
    ).get(other, me);
    const unread = unreadRow.c;
    return {
      userId: other,
      name: card.name,
      gender: card.gender,
      trustLevel: card.trustLevel,
      unread,
      lastMessage: last ? { text: last.kind === 'ephemeral' ? 'صورة مؤقتة 👁' : last.text, at: last.created_at, fromMe: last.sender_id === me } : null,
      blocked: await userBlocked(me, other),
    };
  }))).filter(Boolean);

  res.json({ conversations });
}));

// GET /api/conversations/{id}/messages
router.get('/conversations/:id/messages', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!await areMutual(me, other)) return apiError(res, 403, 'NOT_MUTUAL', 'المحادثة لا تُفتح إلا بعد الإعجاب المتبادل (Wasla_18)');
  const msgs = await db.prepare(
    `SELECT id, sender_id, text, kind, created_at FROM messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY id ASC LIMIT 500`
  ).all(me, other, other, me);
  res.json({ messages: msgs.map((m) => ({ id: m.id, fromMe: m.sender_id === me, text: m.text, kind: m.kind, at: m.created_at })) });
}));

// POST /api/conversations/{id}/messages  { text }
router.post('/conversations/:id/messages', authRequired, emailVerifiedRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  const text = String((req.body && req.body.text) || '').trim();
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!text || text.length > 1000) return apiError(res, 422, 'EMPTY_MESSAGE', 'اكتب رسالة قبل الإرسال', 'text');
  if (!await areMutual(me, other)) return apiError(res, 403, 'NOT_MUTUAL', 'المحادثة لا تُفتح إلا بعد الإعجاب المتبادل (Wasla_18)');
  if (await userBlocked(other, me)) return apiError(res, 403, 'BLOCKED', 'لا يمكنك مراسلة هذا العضو', 'text');

  // Free-tier daily message quota: counts only when I start the thread (Wasla_17)
  const incoming = await isIncomingConversation(me, other);
  if (!incoming && !await canSendMessage(me)) {
    return apiError(res, 403, 'MESSAGE_QUOTA_EXCEEDED', 'لقد تجاوزت الحد اليومي للرسائل المُطلقة — اشترِك للمراسلة بدون حدود', 'text');
  }

  // Content moderation for messages (Wasla_15)
  const mod = await checkMessage(me, text, null);
  if (!mod.allowed) {
    return apiError(res, 422, 'MODERATION_REJECT', 'لا يُسمح بمشاركة وسائل تواصل أو روابط أو بيانات اتصال داخل الرسائل. الرجاء إعادة الصياغة.', 'text', { violations: mod.violations });
  }

  const r = await db.prepare('INSERT INTO messages (sender_id, receiver_id, text, kind) VALUES (?, ?, ?, ?)')
    .run(me, other, text, 'text');
  if (!incoming) await useMessage(me);
  await notify(other, 'message', 'رسالة جديدة منك', me);
  await publish('MessageSent', { receiverId: other, messageId: Number(r.lastInsertRowid) }, 'api', { userId: me, entityType: 'message', entityId: String(r.lastInsertRowid) });
  pushToUser(other, {
    event: 'MessageReceived',
    message: { id: Number(r.lastInsertRowid), fromMe: false, text, kind: 'text', at: nowIso(), senderId: me },
  });
  res.status(201).json({ message: { id: Number(r.lastInsertRowid), fromMe: true, text, kind: 'text', at: nowIso() } });
}));

// POST /api/conversations/{id}/messages/{mid}/read
router.post('/conversations/:id/messages/:mid/read', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  await db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?')
    .run(other, me);
  res.json({ ok: true });
}));

// POST /api/conversations/{id}/photo-ephemeral
router.post('/conversations/:id/photo-ephemeral', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.id);
  if (!await areMutual(me, other)) return apiError(res, 403, 'NOT_MUTUAL', 'المحادثة لا تُفتح إلا بعد الإعجاب المتبادل (Wasla_18)');
  const r = await db.prepare('INSERT INTO messages (sender_id, receiver_id, kind) VALUES (?, ?, ?)')
    .run(me, other, 'ephemeral');
  res.status(201).json({ message: { id: Number(r.lastInsertRowid), fromMe: true, kind: 'ephemeral', at: nowIso() } });
}));

// POST /api/block/{memberId}  { reason? }
router.post('/block/:memberId', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.memberId);
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!await pubUser(other)) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  await db.prepare('INSERT IGNORE INTO blocked_members (user_id, blocked_id) VALUES (?, ?)').run(me, other);
  res.json({ ok: true });
}));

// POST /api/report/{memberId}  { reason }
router.post('/report/:memberId', authRequired, ah(async (req, res) => {
  const me = req.userId;
  const other = Number(req.params.memberId);
  const reason = String((req.body && req.body.reason) || '').trim() || 'بدون سبب';
  if (!Number.isInteger(other) || other === me) return apiError(res, 422, 'INVALID_USER', 'معرّف مستخدم غير صالح');
  if (!await pubUser(other)) return apiError(res, 404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
  const r = await db.prepare('INSERT INTO reports (reporter_id, reported_id, reason) VALUES (?, ?, ?)')
    .run(me, other, reason.slice(0, 500));
  await publish('UserReported', { reportedId: other, reason }, 'api', { userId: me, entityType: 'report', entityId: String(Number(r.lastInsertRowid)) });
  res.status(201).json({ reportId: Number(r.lastInsertRowid), status: 'pending' });
}));

export default router;
