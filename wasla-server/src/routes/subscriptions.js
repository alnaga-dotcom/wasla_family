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
import { ah } from '../async-handler.js';

const router = Router();

// GET /api/plans
router.get('/plans', ah(async (req, res) => {
  const plans = (await listPlans()).map((p) => {
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
}));

// GET /api/me/subscription
router.get('/me/subscription', authRequired, ah(async (req, res) => {
  res.json(await mySubscriptionStatus(req.userId));
}));

// POST /api/me/subscription  { planCode, months? }
// Creates a pending subscription + order, then either activates instantly (mock)
// or returns a checkout URL to redirect the user to the live gateway (066city).
router.post('/me/subscription', authRequired, ah(async (req, res) => {
  const { planCode, months } = req.body || {};
  if (!planCode || typeof planCode !== 'string') {
    return apiError(res, 422, 'MISSING_PLAN', 'اختر خطة اشتراك', 'planCode');
  }
  const plan = await planByCode(planCode);
  if (!plan) return apiError(res, 404, 'PLAN_NOT_FOUND', 'الخطة غير موجودة', 'planCode');

  const sub = await createPendingSubscription(req.userId, planCode, months ? Number(months) : undefined);
  if (!sub) return apiError(res, 500, 'SUBSCRIPTION_FAILED', 'فشل إنشاء الاشتراك');

  const orderId = `WAS-${req.userId}-${sub.subscriptionId}-${Date.now()}`;
  await createPayment(req.userId, sub.subscriptionId, plan.price_egp, getProvider().name, orderId);

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
    await confirmPayment(req.userId, sub.subscriptionId, plan.price_egp, provider.name, checkout.providerRef);
    return res.status(201).json({ subscription: sub, status: 'active', gateway: provider.name });
  }

  res.status(201).json({
    subscription: sub,
    status: 'pending',
    gateway: provider.name,
    checkoutUrl: checkout.checkoutUrl,
    orderId,
  });
}));

// GET /api/payments/status  → whether the app currently uses a live gateway
router.get('/payments/status', (req, res) => {
  res.json({ provider: getProvider().name, live: isLive() });
});

// POST /api/me/subscription/cancel
router.post('/me/subscription/cancel', authRequired, ah(async (req, res) => {
  const r = await db.prepare(
    "UPDATE subscriptions SET status = 'cancelled', auto_renew = 0 WHERE user_id = ? AND status = 'active'"
  ).run(req.userId);
  res.json({ cancelled: r.changes > 0 });
}));

// POST /api/payments/066city/callback  — provider webhook (only when live)
router.post('/payments/066city/callback', ah(async (req, res) => {
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
      ? await db.prepare("SELECT * FROM payments WHERE provider = '066city' AND (provider_ref = ? OR provider_ref = ?) AND status = 'pending' LIMIT 1").get(ref, result.orderId)
      : null;
    if (payment) {
      await confirmPayment(payment.user_id, payment.subscription_id, payment.amount_egp, '066city', ref || result.orderId);
    }
  }
  res.json({ ok: true });
}));

export default router;
