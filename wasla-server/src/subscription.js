import { db } from './db.js';
import { publish } from './events.js';

export const DEFAULT_QUOTAS = {
  likes_per_day: 5,
  messages_per_day: 5,
};

export function activeSubscription(userId) {
  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return db.prepare(
    `SELECT s.*, p.features, p.name AS plan_name
     FROM subscriptions s
     JOIN plans p ON p.code = s.plan_code
     WHERE s.user_id = ?
       AND s.status = 'active'
       AND date(s.starts_at) <= date(?)
       AND date(s.ends_at) >= date(?)
     ORDER BY s.ends_at DESC LIMIT 1`
  ).get(userId, now, now);
}

export function hasEntitlement(userId, entitlement) {
  const sub = activeSubscription(userId);
  if (!sub) return false;
  let features = [];
  try {
    features = JSON.parse(sub.features || '[]');
  } catch { /* ignore */ }
  return features.includes(entitlement);
}

export function isPremium(userId) {
  return !!activeSubscription(userId);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function quotaToday(userId) {
  const row = db.prepare('SELECT likes_used, messages_used FROM daily_quotas WHERE user_id = ? AND day = ?').get(userId, today());
  return row || { likes_used: 0, messages_used: 0 };
}

export function canLike(userId) {
  if (isPremium(userId)) return true;
  const used = quotaToday(userId).likes_used;
  return used < DEFAULT_QUOTAS.likes_per_day;
}

export function canSendMessage(userId) {
  if (isPremium(userId)) return true;
  const used = quotaToday(userId).messages_used;
  return used < DEFAULT_QUOTAS.messages_per_day;
}

export function useLike(userId) {
  db.prepare(
    `INSERT INTO daily_quotas (user_id, day, likes_used) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET likes_used = likes_used + 1`
  ).run(userId, today());
}

export function useMessage(userId) {
  db.prepare(
    `INSERT INTO daily_quotas (user_id, day, messages_used) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET messages_used = messages_used + 1`
  ).run(userId, today());
}

export function resetQuotasForDay(userId, day) {
  db.prepare('DELETE FROM daily_quotas WHERE user_id = ? AND day = ?').run(userId, day);
}

export function listPlans() {
  return db.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY price_egp").all();
}

export function planByCode(code) {
  return db.prepare("SELECT * FROM plans WHERE code = ? AND status = 'active'").get(code);
}

export function createPendingSubscription(userId, planCode, months = null) {
  const plan = planByCode(planCode);
  if (!plan) return null;
  const duration = months || plan.duration_months;
  const startsAt = new Date().toISOString().slice(0, 10);
  const endsAt = new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = db.prepare(
    `INSERT INTO subscriptions (user_id, plan_code, status, starts_at, ends_at, auto_renew) VALUES (?, ?, 'pending', ?, ?, 0)`
  ).run(userId, planCode, startsAt, endsAt);
  const subscriptionId = Number(r.lastInsertRowid);
  publish('SubscriptionCreated', { userId, planCode, subscriptionId }, 'api', { userId, entityType: 'subscription', entityId: String(subscriptionId) });
  return { subscriptionId, planCode, startsAt, endsAt };
}

export function activateSubscription(subscriptionId) {
  const r = db.prepare(
    `UPDATE subscriptions SET status = 'active' WHERE id = ? AND status = 'pending'`
  ).run(subscriptionId);
  if (!r.changes) return false;
  const sub = db.prepare('SELECT user_id, plan_code FROM subscriptions WHERE id = ?').get(subscriptionId);
  publish('SubscriptionActivated', { userId: sub.user_id, planCode: sub.plan_code, subscriptionId }, 'api', { userId: sub.user_id, entityType: 'subscription', entityId: String(subscriptionId) });
  return true;
}

export function createPayment(userId, subscriptionId, amountEgp, provider = 'mock', providerRef = null) {
  const r = db.prepare(
    `INSERT INTO payments (user_id, subscription_id, amount_egp, provider, provider_ref, status) VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(userId, subscriptionId, amountEgp, provider, providerRef);
  return Number(r.lastInsertRowid);
}

export function confirmPayment(userId, subscriptionId, amountEgp, provider, providerRef) {
  const r = db.prepare(
    `UPDATE payments SET status = 'paid', provider_ref = ? WHERE user_id = ? AND subscription_id = ? AND status = 'pending'`
  ).run(providerRef || null, userId, subscriptionId);
  if (!r.changes) return false;
  activateSubscription(subscriptionId);
  publish('PaymentPaid', { userId, subscriptionId, amountEgp, provider }, 'api', { userId, entityType: 'payment', entityId: String(subscriptionId) });
  return true;
}

export function mySubscriptionStatus(userId) {
  const sub = activeSubscription(userId);
  const quota = quotaToday(userId);
  return {
    isPremium: !!sub,
    plan: sub ? { code: sub.plan_code, name: sub.plan_name, endsAt: sub.ends_at } : null,
    quotas: {
      likes: { used: quota.likes_used, limit: DEFAULT_QUOTAS.likes_per_day },
      messages: { used: quota.messages_used, limit: DEFAULT_QUOTAS.messages_per_day },
    },
  };
}

export function isIncomingConversation(me, other) {
  const row = db.prepare(
    `SELECT 1 FROM messages WHERE sender_id = ? AND receiver_id = ? LIMIT 1`
  ).get(other, me);
  return !!row;
}
