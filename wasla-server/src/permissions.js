import { db } from './db.js';

export const roles = [
  'user', 'viewer', 'moderator', 'verification_officer', 'customer_support',
  'rule_admin', 'subscription_admin', 'admin', 'super_admin'
];

export function listPermissions(role) {
  return db.prepare(`SELECT resource, action FROM role_permissions WHERE role = ?`).all(role);
}

export function hasPermission(role, resource, action) {
  const row = db.prepare(
    `SELECT 1 FROM role_permissions WHERE role = ? AND resource = ? AND action = ?`
  ).get(role, resource, action);
  return !!row;
}

export function requirePermission(role, resource, action) {
  if (!hasPermission(role, resource, action)) {
    const error = new Error(`Role '${role}' lacks permission ${resource}.${action}`);
    error.code = 'ADMIN_REQUIRED';
    throw error;
  }
}

export function canManageRole(actorRole, targetRole) {
  // super_admin may manage all; admin may not manage super_admin/roles.
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') return targetRole !== 'super_admin' && targetRole !== 'admin';
  return false;
}

export function hasOwnScope(role, resource, action) {
  // Used by audit and queues: all staff can view their own scope actions.
  return role === 'moderator' || role === 'verification_officer' || role === 'customer_support' ||
         role === 'rule_admin' || role === 'subscription_admin' || role === 'admin' || role === 'super_admin';
}

export function isStaff(role) {
  return role !== 'user';
}

export function listAllRoles() {
  return roles;
}

export function listAllPermissions() {
  return db.prepare(`SELECT role, resource, action FROM role_permissions ORDER BY role, resource, action`).all();
}
