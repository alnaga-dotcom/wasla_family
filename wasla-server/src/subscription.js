import { db } from './db.js';
import { publish } from './events.js';

export const DEFAULT_QUOTAS = {
  likes_per_day: 5,
  messages_per_day: 5,
};

export async function activeSubscription(userId) {
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

export async function hasEntitlement(userId, entitlement) {
  const sub = await activeSubscription(userId);
  if (!sub) return false;
  let features = [];
  try {
    features = JSON.parse(sub.features || '[]');
  } catch { /* ignore */ }
  return features.includes(entitlement);
}

export async function isPremium(userId) {
  return !!(await activeSubscription(userId));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function quotaToday(userId) {
  const row = await db.prepare('SELECT likes_used, messages_used FROM daily_quotas WHERE user_id = ? AND day = ?').get(userId, today());
  return row || { likes_used: 0, messages_used: 0 };
}

export async function canLike(userId) {
  if (await isPremium(userId)) return true;
  const used = (await quotaToday(userId)).likes_used;
  return used < DEFAULT_QUOTAS.likes_per_day;
}

export async function canSendMessage(userId) {
  if (await isPremium(userId)) return true;
  const used = (await quotaToday(userId)).messages_used;
  return used < DEFAULT_QUOTAS.messages_per_day;
}

export async function useLike(userId) {
  await db.prepare(
    `INSERT INTO daily_quotas (user_id, day, likes_used) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE likes_used = likes_used + 1`
  ).run(userId, today());
}

export async function useMessage(userId) {
  await db.prepare(
    `INSERT INTO daily_quotas (user_id, day, messages_used) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE messages_used = messages_used + 1`
  ).run(userId, today());
}

export async function resetQuotasForDay(userId, day) {
  await db.prepare('DELETE FROM daily_quotas WHERE user_id = ? AND day = ?').run(userId, day);
}

export async function listPlans() {
  return db.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY price_egp").all();
}

export async function planByCode(code) {
  return db.prepare("SELECT * FROM plans WHERE code = ? AND status = 'active'").get(code);
}

export async function createPendingSubscription(userId, planCode, months = null) {
  const plan = await planByCode(planCode);
  if (!plan) return null;
  const duration = months || plan.duration_months;
  const startsAt = new Date().toISOString().slice(0, 10);
  const endsAt = new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await db.prepare(
    `INSERT INTO subscriptions (user_id, plan_code, status, starts_at, ends_at, auto_renew) VALUES (?, ?, 'pending', ?, ?, 0)`
  ).run(userId, planCode, startsAt, endsAt);
  const subscriptionId = Number(r.lastInsertRowid);
  await publish('SubscriptionCreated', { userId, planCode, subscriptionId }, 'api', { userId, entityType: 'subscription', entityId: String(subscriptionId) });
  return { subscriptionId, planCode, startsAt, endsAt };
}

export async function activateSubscription(subscriptionId) {
  const r = await db.prepare(
    `UPDATE subscriptions SET status = 'active' WHERE id = ? AND status = 'pending'`
  ).run(subscriptionId);
  if (!r.changes) return false;
  const sub = await db.prepare('SELECT user_id, plan_code FROM subscriptions WHERE id = ?').get(subscriptionId);
  await publish('SubscriptionActivated', { userId: sub.user_id, planCode: sub.plan_code, subscriptionId }, 'api', { userId: sub.user_id, entityType: 'subscription', entityId: String(subscriptionId) });
  return true;
}

export async function createPayment(userId, subscriptionId, amountEgp, provider = 'mock', providerRef = null) {
  const r = await db.prepare(
    `INSERT INTO payments (user_id, subscription_id, amount_egp, provider, provider_ref, status) VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(userId, subscriptionId, amountEgp, provider, providerRef);
  return Number(r.lastInsertRowid);
}

export async function confirmPayment(userId, subscriptionId, amountEgp, provider, providerRef) {
  const r = await db.prepare(
    `UPDATE payments SET status = 'paid', provider_ref = ? WHERE user_id = ? AND subscription_id = ? AND status = 'pending'`
  ).run(providerRef || null, userId, subscriptionId);
  if (!r.changes) return false;
  await activateSubscription(subscriptionId);
  await publish('PaymentPaid', { userId, subscriptionId, amountEgp, provider }, 'api', { userId, entityType: 'payment', entityId: String(subscriptionId) });
  return true;
}

export async function mySubscriptionStatus(userId) {
  const sub = await activeSubscription(userId);
  const quota = await quotaToday(userId);
  return {
    isPremium: !!sub,
    plan: sub ? { code: sub.plan_code, name: sub.plan_name, endsAt: sub.ends_at } : null,
    quotas: {
      likes: { used: quota.likes_used, limit: DEFAULT_QUOTAS.likes_per_day },
      messages: { used: quota.messages_used, limit: DEFAULT_QUOTAS.messages_per_day },
    },
  };
}

export async function isIncomingConversation(me, other) {
  const row = await db.prepare(
    `SELECT 1 FROM messages WHERE sender_id = ? AND receiver_id = ? LIMIT 1`
  ).get(other, me);
  return !!row;
}
