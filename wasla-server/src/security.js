import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { config, isProduction } from './config.js';

export function applySecurityMiddleware(app) {
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'http:'],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction() ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  }));

  app.use(hpp());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const windowMs = 60 * 1000;

  const generous = !isProduction();

  app.use(slowDown({
    windowMs,
    delayAfter: generous ? 5000 : 60,
    delayMs: () => 500,
    maxDelayMs: 5000,
  }));

  app.use(rateLimit({
    windowMs,
    max: generous ? 10000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ code: 'RATE_LIMIT', message: 'عدد طلبات كبير، جرّب بعد دقيقة' });
    },
  }));

  const authLimiter = rateLimit({
    windowMs: generous ? 60 * 1000 : 15 * 60 * 1000,
    max: generous ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      res.status(429).json({ code: 'AUTH_RATE_LIMIT', message: 'محاولات كثيرة، جرّب لاحقًا' });
    },
  });
  app.use('/api/auth', authLimiter);
  app.use('/admin', authLimiter);
}
