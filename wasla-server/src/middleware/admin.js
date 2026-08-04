import { db } from '../db.js';
import { apiError } from '../validate.js';
import { config } from '../config.js';
import { hasPermission, isStaff } from '../permissions.js';

export function adminRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const adminKey = req.headers['x-admin-key'] || '';

  if (adminKey && adminKey === config.adminKey) {
    req.adminContext = { key: true, role: 'super_admin' };
    req.userId = null;
    return next();
  }

  if (token) {
    const row = db.prepare(
      'SELECT s.user_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    ).get(token);
    if (row && isStaff(row.role)) {
      req.adminContext = { userId: row.user_id, role: row.role };
      req.userId = row.user_id;
      return next();
    }
  }

  return apiError(res, 403, 'ADMIN_REQUIRED', 'يتطلب صلاحيات إدارية');
}

export function permissionRequired(resource, action) {
  return (req, res, next) => {
    adminRequired(req, res, (err) => {
      if (err) return next(err);
      const ctx = req.adminContext;
      if (ctx.key && config.adminKey && config.adminKey !== 'skip') return next();
      if (hasPermission(ctx.role, resource, action)) return next();
      return apiError(res, 403, 'ADMIN_REQUIRED', `يتطلب صلاحية ${resource}.${action}`);
    });
  };
}

