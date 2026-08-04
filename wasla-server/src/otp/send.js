import { logger } from '../logger.js';

export const OTP_PROVIDER = process.env.WASLA_OTP_PROVIDER || 'console';

const OTP_EXPIRY_SECONDS = Math.max(30, Number(process.env.WASLA_OTP_EXPIRY_MS || 300000)) / 1000;

function normalizePhoneForSms(phone) {
  return String(phone).trim();
}

async function sendConsole({ phone, email, code }) {
  logger.info(`[CONSOLE OTP] phone=${phone} email=${email || '-'} code=${code}`);
  return { ok: true, channel: 'console' };
}

async function sendTwilio({ phone, code }) {
  const { default: twilio } = await import('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const message = await client.messages.create({
    body: `رمز التحقق الخاص بك في وصلة: ${code} (صالح لمدة ${OTP_EXPIRY_SECONDS} ثانية)`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalizePhoneForSms(phone),
  });
  logger.info('Twilio SMS sent', { sid: message.sid, to: phone });
  return { ok: true, channel: 'sms', sid: message.sid };
}

async function sendEmail({ email, code }) {
  if (!email) throw new Error('Email not provided for email OTP provider');
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: `"وصلة" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'رمز التحقق الخاص بك في وصلة',
    text: `رمز التحقق: ${code}\nصالح لمدة ${OTP_EXPIRY_SECONDS} ثانية.`,
    html: `<p>رمز التحقق الخاص بك في <strong>وصلة</strong>:</p><h1 style="direction:rtl;letter-spacing:4px">${code}</h1><p>صالح لمدة ${OTP_EXPIRY_SECONDS} ثانية.</p>`,
  });
  logger.info('Email OTP sent', { to: email });
  return { ok: true, channel: 'email' };
}

export async function sendOtp({ phone, email, code }) {
  try {
    if (OTP_PROVIDER === 'twilio') return await sendTwilio({ phone, code });
    if (OTP_PROVIDER === 'email') return await sendEmail({ email, code });
    if (OTP_PROVIDER === 'console') return await sendConsole({ phone, email, code });
    throw new Error(`Unknown OTP provider: ${OTP_PROVIDER}`);
  } catch (err) {
    logger.error('OTP send failed', { provider: OTP_PROVIDER, error: err.message });
    throw err;
  }
}

export function isOtpProviderConfigured() {
  if (OTP_PROVIDER === 'console') return true;
  if (OTP_PROVIDER === 'twilio') {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  }
  if (OTP_PROVIDER === 'email') {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }
  return false;
}
