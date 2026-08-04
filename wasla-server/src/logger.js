import { createLogger, format, transports } from 'winston';
import { mkdirSync } from 'node:fs';

const { combine, timestamp, printf, colorize, errors } = format;

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  try { mkdirSync('logs', { recursive: true }); } catch {}
}

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length) msg += ` ${JSON.stringify(metadata)}`;
  if (stack) msg += `\n${stack}`;
  return msg;
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: { service: 'wasla-server' },
  format: isProduction
    ? combine(timestamp(), format.json(), errors({ stack: true }))
    : combine(colorize(), timestamp(), logFormat, errors({ stack: true })),
  transports: [
    new transports.Console(),
  ],
});

if (isProduction) {
  logger.add(new transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new transports.File({ filename: 'logs/combined.log' }));
}

if (typeof process !== 'undefined') {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}
