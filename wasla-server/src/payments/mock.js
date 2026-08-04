// Mock payment provider — used by default so the prototype never touches real money.
// In production set WASLA_PAYMENT_PROVIDER=066city (or keep mock to disable live payments).
export const name = 'mock';
export const isConfigured = () => true;

// Simulates initiating a checkout; always succeeds immediately.
export async function createCheckout({ orderId, amountEgp, description, userId }) {
  console.log(`[payments:mock] checkout ${orderId} | ${amountEgp} EGP | ${description} (user ${userId})`);
  return {
    checkoutUrl: null, // no redirect needed — mock pays instantly
    providerRef: `mock-${orderId}`,
    instantSuccess: true,
  };
}

// Webhooks are never invoked for the mock provider.
export async function handleWebhook() {
  return { handled: false };
}
