# Wasla Server — V1 Backend Prototype

Registration (OTP), sessions, and profile/onboarding endpoints.
Implements: Wasla_03 (registration), Wasla_07 (data model), Wasla_21 (error envelope), Wasla_29 (endpoints).

## Run

```bash
npm install
npm run dev        # or npm start
# server on http://127.0.0.1:4000
```

SQLite database file is created at `data/wasla.db` (Node built-in `node:sqlite`, no extra DB server).

> ⚠️ `WASLA_DEV_OTP=false` disables echoing the OTP in responses. For local testing leave it on; **must be off in any real deployment** (Wasla_22).

## Flow (Wasla_03)

1. `POST /api/auth/register` `{ name, phone, gender }` → creates pending user + OTP (`dev.otp` echoed locally)
2. `POST /api/auth/otp/verify` `{ phone, code }` → activates account, returns `{ token }`
3. `POST /api/auth/login` `{ phone }` → sends OTP for an existing active account
4. `GET /api/auth/me` (Bearer) · `POST /api/auth/logout`
5. `GET /api/profile/me` · `GET /api/profile/completion` · `PATCH /api/profile/me` `{ field_key, value }`

Completion % follows Wasla_05 §9 (tiered weights + verification boosts), always personal.

## Test

```bash
node scripts/smoke.mjs     # full flow, expects server on :4000
```

## Conventions

- Errors: `{ code, message, field?, ref }` (Wasla_21).
- Auth: `Authorization: Bearer <token>`.
- Phone: Egyptian `01xxxxxxxxx` (+20 forms accepted), normalized on store.
- Profile fields validated against `src/fields.js` (tier/domain/sensitive per Wasla_05).

## Next (not implemented)

- Real SMS/OTP provider + rate limiting (Wasla_22)
- Matching/Discovery/Recommendation endpoints (Wasla_12/13/28)
- Messaging after mutual like (Wasla_18/27)
- Admin + moderation (Wasla_15/20/25)
- Payments (Wasla_17)
