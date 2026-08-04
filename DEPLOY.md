# Wasla V1 Deployment Guide

## Recommended architecture

- **Backend API**: Render / Railway free tier (Docker).
- **Landing page + web app + APK**: your shared host (cPanel).
- **Domain**: `wasla.family` (or your choice).
- **Subdomain for app**: `app.wasla.family`.

## What you need to provide

1. A GitHub account (free) — Render deploys from a GitHub repo.
2. A Render or Railway account.
3. The domain purchased and DNS pointing to your shared host.
4. A strong secret for `WASLA_ADMIN_KEY`.
5. A Gmail account with an **App password** for sending OTP emails
   (Google Account → Security → 2-Step Verification → App passwords).

## Put the code on GitHub (one-time)

Render pulls the backend from a git repo, so the code must be on GitHub first:

```powershell
cd A:\Wasla
git init
git add -A
git commit -m "Wasla V1"
# then create an empty private repo on github.com and:
git remote add origin https://github.com/<you>/wasla.git
git push -u origin main
```

## Build the deploy package

From the repo root:

```powershell
# Replace with your real Render URL and domain
$env:WASLA_API_BASE='https://wasla-api.onrender.com'
$env:WASLA_APP_URL='https://app.wasla.family'
$env:WASLA_DOMAIN='wasla.family'
node scripts/prepare-deploy.mjs
```

This creates `deploy/` with:

- `landing/` → upload to `public_html`.
- `app/` → upload to `app.wasla.family` document root.
- `wasla.apk` → signed release APK; place it on the landing page for download.

## Deploy the backend on Render

1. Create a new Web Service and point it to `wasla-server/`.
2. Use the `Dockerfile` included there.
3. Add a disk mounted at `/app/data` (so SQLite + uploads persist).
4. Set environment variables:

   ```text
   NODE_ENV=production
   PORT=3000
   WASLA_PUBLIC_DOMAIN=https://wasla.family
   WASLA_CORS_ORIGINS=https://wasla.family,https://app.wasla.family,https://www.wasla.family
   WASLA_ADMIN_KEY=<your-strong-random-secret>
   WASLA_TRUST_PROXY=1
   WASLA_UPLOADS_DIR=/app/data/uploads
   WASLA_DEV_OTP=false
   WASLA_PAYMENT_PROVIDER=mock
   # Activate live payments (066.city) only after obtaining credentials:
   # WASLA_PAYMENT_PROVIDER=066city
   # WASLA_066_MERCHANT_ID=<...>
   # WASLA_066_API_KEY=<...>
   # WASLA_066_SECRET=<...>
   ```

5. **OTP provider is REQUIRED — production refuses to boot without one.** The server
   exits at startup unless `WASLA_OTP_PROVIDER` is `twilio` or `email` with valid
   credentials (set `WASLA_DEV_OTP=false` too). **Email (SMTP) is the recommended default.**

   ```text
   # Option A (recommended): Email via Gmail (app password)
   WASLA_OTP_PROVIDER=email
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=you@gmail.com
   SMTP_PASS=<16-char-gmail-app-password>
   SMTP_FROM=you@gmail.com

   # Option B: Email via any other SMTP (Mailgun, Zoho, etc.)
   WASLA_OTP_PROVIDER=email
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<...>
   SMTP_PASS=<...>
   SMTP_FROM="Wasla <no-reply@wasla.family>"

   # Option C: SMS via Twilio
   WASLA_OTP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=<...>
   TWILIO_AUTH_TOKEN=<...>
   TWILIO_PHONE_NUMBER=<e.g. +15551234567>
   ```

6. Deploy. The health check endpoint is `/api/health`.
7. Payments: the app ships with `mock` provider (instant, no real money). Flip `WASLA_PAYMENT_PROVIDER=066city` and add the 066.city credentials when ready to take live payments.

## Activate real push notifications (Firebase FCM)

Push works in `console` mode out of the box (no-op, logs to server). To deliver real
notifications to the Android app:

1. Create a Firebase project and add an Android app (package `app.wasla.mobile`).
2. Download `google-services.json` and replace
   `wasla-app/android/app/google-services.json`.
3. In Firebase console → Project settings → Service accounts, generate a private key
   (JSON) and set these env vars on the backend:

   ```text
   FIREBASE_PROJECT_ID=<project_id>
   FIREBASE_CLIENT_EMAIL=<service-account-email>
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   (Render does not allow newlines in env values — use `\n` escapes as above; the server
   converts them automatically.)
4. Rebuild the APK so it includes the real `google-services.json`:

   ```powershell
   cd wasla-app
   npm run cap:build:release
   ```

5. Sanity-check: log in on a device, then call
   `POST /api/push/test` (X-Admin-Key header) or send a message between two accounts —
   a push should arrive.

## Post-deploy verification checklist

1. `GET https://<your-api>/api/health` → `{ ok: true, env: "production", domain: "https://wasla.family" }`.
2. Open `https://wasla.family` → stats and pricing load from the API.
3. Open `https://app.wasla.family` → register a test account; the OTP arrives by email.
4. Log in as admin (`/admin` with `WASLA_ADMIN_KEY`), check "التوثيق" and "الاشتراكات" tabs.
5. Request verification from a test profile → approve it in the admin panel → the badge shows.
6. Subscribe to a plan (mock provider) → status flips to `active`.
7. Test Android push via `/api/push/test` with a registered device token.

## Deploy static files on shared host (cPanel)

1. Upload `deploy/landing/*` to `public_html`.
2. In cPanel, create subdomain `app.wasla.family` and upload `deploy/app/*` to its folder.
3. Make sure `mod_rewrite` is enabled (the included `.htaccess` handles SPA routing).
4. Upload `deploy/wasla.apk` and add a download link on the landing page.

## Rebuild the Android APK

```powershell
cd wasla-app
$env:WASLA_API_BASE='https://wasla-api.onrender.com'
npm run cap:build:release
```

The signed APK will be at:

```text
wasla-app/android/app/build/outputs/apk/release/app-release.apk
```

> The included signing keystore (`wasla-app/android/keystore.jks`) is a placeholder. Replace it with your own keystore before publishing to Google Play.

## SSL

- Render and Railway provide HTTPS automatically.
- cPanel usually provides free AutoSSL. Make sure both `wasla.family` and `app.wasla.family` are covered.

## Local development

- Server: `cd wasla-server && npm run dev`
- App: `cd wasla-app && npm run dev`
- Landing: `cd wasla-landing && npm run dev`
- Run all tests: use the commands in `.github/workflows/ci.yml`
