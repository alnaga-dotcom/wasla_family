import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'

const envFile = path.resolve('wasla-server', '.env.production')
if (!fs.existsSync(envFile)) {
  console.log('no .env.production')
  process.exit(1)
}
const env = {}
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const host = process.env.SMTP_HOST || env.SMTP_HOST || 'smtp.gmail.com'
const port = Number(process.env.SMTP_PORT || env.SMTP_PORT || 465)
const secure = String(process.env.SMTP_SECURE || env.SMTP_SECURE || 'true') === 'true'
const user = env.SMTP_USER
const pass = env.SMTP_PASS

console.log('probe host=%s port=%d secure=%s user=%s', host, port, secure, user)

const t = nodemailer.createTransport({
  host,
  port,
  secure,
  family: 4,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  auth: { user, pass },
})

try {
  const info = await t.sendMail({
    from: env.SMTP_FROM || user,
    to: '066.city@gmail.com',
    subject: 'Wasla SMTP probe 587',
    text: 'If you see this, the 587 config is valid.',
  })
  console.log('OK messageId=%s', info.messageId)
} catch (err) {
  console.log('FAILED:', err && err.response ? err.response : err.message)
  if (err && err.responseCode) console.log('code=%s', err.responseCode)
}
