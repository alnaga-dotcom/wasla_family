import { WebSocketServer } from 'ws';
import { db } from './db.js';
import { logger } from './logger.js';

// بث لحظي للرسائل والإشعارات عبر WebSocket — Wasla_27
const clients = new Map(); // userId -> Set<ws>

export function initRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const userId = authenticate(req);
    if (!userId) {
      ws.close(4001, 'unauthorized');
      return;
    }
    ws.userId = userId;
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);
    logger.info(`ws user ${userId} connected (${clients.get(userId).size} sockets)`);

    ws.on('close', () => {
      const set = clients.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(userId);
      }
    });
    ws.on('error', () => ws.close());
  });

  return wss;
}

function authenticate(req) {
  const url = new URL(req.url, 'http://localhost');
  const qToken = url.searchParams.get('token');
  const hToken = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = qToken || hToken;
  if (!token) return null;
  const row = db.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  ).get(token);
  return row ? row.user_id : null;
}

// أرسل حدثًا لحظيًا لكل اتصالات المستخدم
export function pushToUser(userId, event) {
  const set = clients.get(Number(userId));
  if (!set) return;
  const msg = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

export function countConnections() {
  let n = 0;
  for (const set of clients.values()) n += set.size;
  return n;
}
