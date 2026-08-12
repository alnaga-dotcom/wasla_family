import { db } from '../db.js';
import { apiError } from '../validate.js';
import { config } from '../config.js';
import { hasPermission, isStaff } from '../permissions.js';
import { ah } from '../async-handler.js';

export const adminRequired = ah(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const adminKey = req.headers['x-admin-key'] || '';

  if (adminKey && adminKey === config.adminKey) {
    req.adminContext = { key: true, role: 'super_admin' };
    req.userId = null;
    return next();
  }

  if (token) {
    const adminSession = await db.prepare(
      'SELECT token, expires_at FROM admin_sessions WHERE token = ?'
    ).get(token);
    if (adminSession && new Date(adminSession.expires_at + 'Z') > new Date()) {
      req.adminContext = { adminPanel: true, role: 'super_admin' };
      req.userId = null;
      return next();
    }
    const row = await db.prepare(
      'SELECT s.user_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    ).get(token);
    if (row && isStaff(row.role)) {
      req.adminContext = { userId: row.user_id, role: row.role };
      req.userId = row.user_id;
      return next();
    }
  }

  return apiError(res, 403, 'ADMIN_REQUIRED', 'يتطلب صلاحيات إدارية');
});

export function permissionRequired(resource, action) {
  return ah(async (req, res, next) => {
    await adminRequired(req, res, async (err) => {
      if (err) return next(err);
      const ctx = req.adminContext;
      if (ctx.key && config.adminKey && config.adminKey !== 'skip') return next();
      if (await hasPermission(ctx.role, resource, action)) return next();
      return apiError(res, 403, 'ADMIN_REQUIRED', `يتطلب صلاحية ${resource}.${action}`);
    });
  });
}
