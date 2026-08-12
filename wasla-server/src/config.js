import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOtpProviderConfigured } from './otp/send.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Echo the OTP in the response so the local prototype is testable without an SMS provider.
  // MUST be false in any real deployment.
  devOtpEcho: process.env.WASLA_DEV_OTP !== 'false',
  otpExpiryMs: Number(process.env.WASLA_OTP_EXPIRY_MS || 5 * 60 * 1000),
  sessionTtlMs: Number(process.env.WASLA_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000),
  adminKey: process.env.WASLA_ADMIN_KEY || 'dev-admin-key-change-me',
  // Admin panel credentials (username/password). Defaults are dev-only; production refuses to boot with them.
  adminUser: process.env.WASLA_ADMIN_USER || 'admin',
  adminPass: process.env.WASLA_ADMIN_PASS || 'admin',
  // Public domain for production CORS and links (e.g., https://wasla.family)
  publicDomain: process.env.WASLA_PUBLIC_DOMAIN || '',
  // Allowed CORS origins in production (comma-separated). Empty/default = local dev wildcard.
  corsOrigins: (process.env.WASLA_CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  // MySQL (Hostinger managed database — survives redeploys, never wiped)
  db: {
    host: process.env.WASLA_DB_HOST || '127.0.0.1',
    port: Number(process.env.WASLA_DB_PORT || 3306),
    user: process.env.WASLA_DB_USER || 'root',
    password: process.env.WASLA_DB_PASSWORD || '',
    name: process.env.WASLA_DB_NAME || 'wasla',
  },
  // Security
  trustProxy: process.env.WASLA_TRUST_PROXY === 'true',
  uploadsDir: process.env.WASLA_UPLOADS_DIR || join(__dirname, '..', 'uploads'),
  // Payments: 'mock' (instant, no real money) or '066city'. Set to 'mock' to disable live gateways.
  paymentProvider: process.env.WASLA_PAYMENT_PROVIDER || 'mock',
  // 066.city gateway credentials (only used when paymentProvider === '066city')
  payment066city: {
    merchantId: process.env.WASLA_066_MERCHANT_ID || '',
    apiKey: process.env.WASLA_066_API_KEY || '',
    secret: process.env.WASLA_066_SECRET || '',
    baseUrl: process.env.WASLA_066_BASE_URL || 'https://api.066.city',
  },
};

export function isProduction() {
  return config.nodeEnv === 'production';
}

export function isDevelopment() {
  return config.nodeEnv === 'development';
}

export function validateConfig() {
  if (isProduction()) {
    if (config.devOtpEcho) {
      throw new Error('WASLA_DEV_OTP must be false in production');
    }
    if (!config.adminKey || config.adminKey === 'dev-admin-key-change-me') {
      throw new Error('WASLA_ADMIN_KEY must be set to a strong secret in production');
    }
    if (config.adminUser === 'admin' || config.adminPass === 'admin') {
      throw new Error('WASLA_ADMIN_USER and WASLA_ADMIN_PASS must be changed from the dev defaults in production');
    }
    if (!config.publicDomain) {
      throw new Error('WASLA_PUBLIC_DOMAIN is required in production');
    }
    if (process.env.WASLA_OTP_PROVIDER === 'console') {
      throw new Error('WASLA_OTP_PROVIDER cannot be console in production');
    }
    if (!isOtpProviderConfigured()) {
      throw new Error('OTP provider is not configured in production. Set WASLA_OTP_PROVIDER=twilio|email and credentials.');
    }
  }
}
