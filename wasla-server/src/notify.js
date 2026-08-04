import { db, nowIso } from './db.js';
import { sendPush } from './push.js';

const TITLES = {
  like: 'إعجاب جديد في وصلة',
  match: 'تطابق متبادل!',
  message: 'رسالة جديدة',
  system: 'وصلة',
};

// إنشاء إشعار لطرفٍ ما — Wasla_16
export async function notify(userId, type, text, fromUserId) {
  db.prepare(
    'INSERT INTO notifications (user_id, from_user_id, type, text, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(userId, fromUserId || null, type, text, nowIso());
  const user = db.prepare('SELECT push_token FROM users WHERE id = ?').get(userId);
  if (user?.push_token) {
    sendPush({
      token: user.push_token,
      title: TITLES[type] || TITLES.system,
      body: text,
      data: { type, fromUserId: String(fromUserId || ''), userId: String(userId) },
    }).catch(() => {});
  }
}

export function unreadCount(userId) {
  return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).c;
}
