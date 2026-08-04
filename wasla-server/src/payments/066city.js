// 066.city payment gateway adapter (Egyptian wallets/cards).
// NOTE: endpoint shapes below are a best-effort scaffold — verify against the live
// 066.city merchant docs and adjust paths/fields before enabling in production.
// Temporarily deactivated unless WASLA_PAYMENT_PROVIDER=066city.
import { config } from '../config.js';

export const name = '066city';
export const isConfigured = () =>
  !!(config.payment066city.merchantId && config.payment066city.apiKey && config.payment066city.secret);

async function call(path, body) {
  const { baseUrl, apiKey, secret } = config.payment066city;
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = await sha256(`${ts}${secret}${JSON.stringify(body)}`);
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Merchant-Id': config.payment066city.merchantId,
      'X-Api-Key': apiKey,
      'X-Timestamp': ts,
      'X-Signature': signature,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`066.city ${path} -> ${res.status} ${text}`);
  }
  return res.json();
}

async function sha256(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createCheckout({ orderId, amountEgp, description }) {
  const data = await call('/v1/orders/create', {
    orderId,
    amount: amountEgp,
    currency: 'EGP',
    description,
    callbackUrl: `${config.publicDomain}/api/payments/066city/callback`,
  });
  return {
    checkoutUrl: data.checkoutUrl || data.url || null,
    providerRef: String(data.orderRef || data.id || orderId),
    instantSuccess: false,
  };
}

export async function handleWebhook(req) {
  // Verify signature from the 066.city callback before trusting it.
  const body = req.body || {};
  const ts = String(body.timestamp || '');
  const sig = String(body.signature || '');
  const expect = await sha256(`${ts}${config.payment066city.secret}${JSON.stringify(body.payload || body)}`);
  if (!sig || sig !== expect) return { handled: false, valid: false };
  return {
    handled: true,
    valid: true,
    orderId: String(body.payload?.orderId || body.orderId || ''),
    status: String(body.payload?.status || body.status || ''),
    providerRef: String(body.payload?.orderRef || body.orderRef || ''),
  };
}
