import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { apiError } from '../validate.js';
import { db } from '../db.js';
import {
  listPlans,
  planByCode,
  createPendingSubscription,
  createPayment,
  confirmPayment,
  mySubscriptionStatus,
} from '../subscription.js';
import { getProvider, isLive } from '../payments/index.js';

const router = Router();

// GET /api/plans
router.get('/plans', (req, res) => {
  const plans = listPlans().map((p) => {
    let features = [];
    try { features = JSON.parse(p.features || '[]'); } catch { /* ignore */ }
    return {
      code: p.code,
      name: p.name,
      durationMonths: p.duration_months,
      priceEgp: p.price_egp,
      regularPriceEgp: p.regular_price_egp,
      features,
    };
  });
  res.json({ plans });
});

// GET /api/me/subscription
router.get('/me/subscription', authRequired, (req, res) => {
  res.json(mySubscriptionStatus(req.userId));
});

// POST /api/me/subscription  { planCode, months? }
// Creates a pending subscription + order, then either activates instantly (mock)
// or returns a checkout URL to redirect the user to the live gateway (066city).
router.post('/me/subscription', authRequired, async (req, res) => {
  const { planCode, months } = req.body || {};
  if (!planCode || typeof planCode !== 'string') {
    return apiError(res, 422, 'MISSING_PLAN', 'اختر خطة اشتراك', 'planCode');
  }
  const plan = planByCode(planCode);
  if (!plan) return apiError(res, 404, 'PLAN_NOT_FOUND', 'الخطة غير موجودة', 'planCode');

  const sub = createPendingSubscription(req.userId, planCode, months ? Number(months) : undefined);
  if (!sub) return apiError(res, 500, 'SUBSCRIPTION_FAILED', 'فشل إنشاء الاشتراك');

  const orderId = `WAS-${req.userId}-${sub.subscriptionId}-${Date.now()}`;
  createPayment(req.userId, sub.subscriptionId, plan.price_egp, getProvider().name, orderId);

  const provider = getProvider();
  let checkout;
  try {
    checkout = await provider.createCheckout({
      orderId,
      amountEgp: plan.price_egp,
      description: plan.name,
      userId: req.userId,
    });
  } catch (err) {
    console.error('[payments] createCheckout failed:', err.message);
    return apiError(res, 502, 'GATEWAY_UNAVAILABLE', 'بوابة الدفع غير متاحة حاليًا. حاول لاحقًا.');
  }

  if (checkout.instantSuccess) {
    confirmPayment(req.userId, sub.subscriptionId, plan.price_egp, provider.name, checkout.providerRef);
    return res.status(201).json({ subscription: sub, status: 'active', gateway: provider.name });
  }

  res.status(201).json({
    subscription: sub,
    status: 'pending',
    gateway: provider.name,
    checkoutUrl: checkout.checkoutUrl,
    orderId,
  });
});

// GET /api/payments/status  → whether the app currently uses a live gateway
router.get('/payments/status', (req, res) => {
  res.json({ provider: getProvider().name, live: isLive() });
});

// POST /api/me/subscription/cancel
router.post('/me/subscription/cancel', authRequired, (req, res) => {
  const r = db.prepare(
    "UPDATE subscriptions SET status = 'cancelled', auto_renew = 0 WHERE user_id = ? AND status = 'active'"
  ).run(req.userId);
  res.json({ cancelled: r.changes > 0 });
});

// POST /api/payments/066city/callback  — provider webhook (only when live)
router.post('/payments/066city/callback', async (req, res) => {
  const provider = getProvider();
  if (provider.name !== '066city') return apiError(res, 404, 'GATEWAY_OFF', 'بوابة الدفع غير مفعّلة');
  const result = await provider.handleWebhook(req);
  if (!result.handled || !result.valid) {
    return res.status(400).json({ ok: false, reason: 'INVALID_SIGNATURE' });
  }
  const ref = result.providerRef || result.orderId;
  const paid = ['paid', 'success', 'captured', 'PAID'].includes(result.status);
  if (paid) {
    const payment = ref
      ? db.prepare("SELECT * FROM payments WHERE provider = '066city' AND (provider_ref = ? OR provider_ref = ?) AND status = 'pending' LIMIT 1").get(ref, result.orderId)
      : null;
    if (payment) {
      confirmPayment(payment.user_id, payment.subscription_id, payment.amount_egp, '066city', ref || result.orderId);
    }
  }
  res.json({ ok: true });
});

export default router;
