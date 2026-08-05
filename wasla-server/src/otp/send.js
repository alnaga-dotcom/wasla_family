import { logger } from '../logger.js';

export const OTP_PROVIDER = process.env.WASLA_OTP_PROVIDER || 'console';

const OTP_EXPIRY_SECONDS = Math.max(30, Number(process.env.WASLA_OTP_EXPIRY_MS || 300000)) / 1000;

// Official Meta WhatsApp Cloud API config
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_TEMPLATE = process.env.WHATSAPP_TEMPLATE_NAME || 'wasla_otp';
const WHATSAPP_LANGUAGE = process.env.WHATSAPP_LANGUAGE || 'ar';
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

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
    body: `رمز التحقق الخاص بك في وصلــه: ${code} (صالح لمدة ${OTP_EXPIRY_SECONDS} ثانية)`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalizePhoneForSms(phone),
  });
  logger.info('Twilio SMS sent', { sid: message.sid, to: phone });
  return { ok: true, channel: 'sms', sid: message.sid };
}

// Official Meta WhatsApp Cloud API — sends an AUTHENTICATION-template OTP message.
// Needs a verified template (default name 'wasla_otp') with one {{1}} variable for the code.
async function sendWhatsApp({ phone, code }) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WhatsApp OTP provider is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
  }
  const to = String(phone).replace(/\D/g, ''); // E.164 → digits, e.g. +2010… → 2010…
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: WHATSAPP_TEMPLATE,
      language: { code: WHATSAPP_LANGUAGE },
      components: [{ type: 'body', parameters: [{ type: 'text', text: String(code) }] }],
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error('WhatsApp OTP send failed', { status: res.status, response: data });
    throw new Error(`WhatsApp API ${res.status}: ${data.error?.message || 'request failed'}`);
  }
  logger.info('WhatsApp OTP sent', { to: phone, wamid: data.messages?.[0]?.id });
  return { ok: true, channel: 'whatsapp', wamid: data.messages?.[0]?.id };
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
    // Force IPv4 + short timeouts so a blocked provider can never hang a request
    // (common on cloud platforms where IPv6 routes are unavailable).
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  await transporter.sendMail({
    from: `"وصلــه" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'رمز التحقق الخاص بك في وصلــه',
    text: `رمز التحقق: ${code}\nصالح لمدة ${OTP_EXPIRY_SECONDS} ثانية.`,
    html: `<p>رمز التحقق الخاص بك في <strong>وصلــه</strong>:</p><h1 style="direction:rtl;letter-spacing:4px">${code}</h1><p>صالح لمدة ${OTP_EXPIRY_SECONDS} ثانية.</p>`,
  });
  logger.info('Email OTP sent', { to: email });
  return { ok: true, channel: 'email' };
}

// channel: 'email' forces the email channel; 'phone' forces the SMS/WhatsApp channel
// (whichever is configured); omitted falls back to the global OTP_PROVIDER.
export async function sendOtp({ phone, email, code, channel }) {
  try {
    if (OTP_PROVIDER === 'console') return await sendConsole({ phone, email, code });
    if (channel === 'email') return await sendEmail({ email, code });
    if (channel === 'phone') {
      if (OTP_PROVIDER === 'twilio') return await sendTwilio({ phone, code });
      if (OTP_PROVIDER === 'whatsapp') return await sendWhatsApp({ phone, code });
      throw new Error(`No phone OTP provider configured (WASLA_OTP_PROVIDER=${OTP_PROVIDER})`);
    }
    if (OTP_PROVIDER === 'twilio') return await sendTwilio({ phone, code });
    if (OTP_PROVIDER === 'whatsapp') return await sendWhatsApp({ phone, code });
    if (OTP_PROVIDER === 'email') return await sendEmail({ email, code });
    throw new Error(`Unknown OTP provider: ${OTP_PROVIDER}`);
  } catch (err) {
    logger.error('OTP send failed', { provider: OTP_PROVIDER, channel: channel || OTP_PROVIDER, error: err.message });
    throw err;
  }
}

export function isOtpProviderConfigured() {
  if (OTP_PROVIDER === 'console') return true;
  if (OTP_PROVIDER === 'twilio') {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  }
  if (OTP_PROVIDER === 'whatsapp') {
    return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
  }
  if (OTP_PROVIDER === 'email') {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }
  return false;
}
