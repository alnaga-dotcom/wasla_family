import { config } from '../config.js';
import * as mock from './mock.js';
import * as city from './066city.js';

const PROVIDERS = { mock, '066city': city };

// Active provider selected by WASLA_PAYMENT_PROVIDER. Falls back to mock when the
// chosen provider isn't configured (so a missing live gateway never breaks the app).
export function getProvider() {
  const wanted = config.paymentProvider in PROVIDERS ? config.paymentProvider : 'mock';
  const provider = PROVIDERS[wanted];
  if (provider.isConfigured()) return provider;
  return mock;
}

export function isLive() {
  return getProvider().name === '066city';
}
