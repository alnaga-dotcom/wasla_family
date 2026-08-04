# Wasla 22 - Security

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Defines the security model protecting member data, sessions, payments, and admin operations. Security is layered and verifiable, not a set of isolated features.

## Objectives

- Protect member privacy as the highest priority.
- Enforce least-privilege and separation of duties.
- Detect and respond to abuse and breaches.
- Comply with privacy expectations stated across all docs (Wasla_01, Wasla_05, Wasla_20).

## Principles

- Data protection by design and by default.
- Defense in depth: multiple independent layers.
- Zero-trust mindset: every request is authenticated or explicitly public; nothing is trusted by default.
- Least privilege everywhere, including internal services.
- Everything important is encrypted, logged, and auditable.
- No secrets in code, config, or client.

## Security Flow

Every request passes the same layered model:

```
Client → Auth → Authorization → Input Validation → Content Moderation (free text) → Rule Engine → Workflow → Business Processing → Audit Log
```

## Identity & Sessions

- Login methods per Wasla_03; phone/email uniqueness enforced.
- Tokens: short-lived access tokens, refresh tokens rotated on use.
- OTP: rate-limited, time-limited, single-use, never logged in plaintext.
- Account linking (Google/Facebook) is revocable by the user.
- Sessions are revocable server-side (logout all, device management).

## Authentication & Authorization

- Member and admin scopes are strictly separated.
- Role-based access control for admin (Wasla_20) with least-privilege roles.
- Every sensitive endpoint re-validates authorization, never relies on the client.
- Abuse of elevated access triggers alerts and Trust Engine events (Wasla_14).

## Data Protection

### At Rest
- Passwords: none stored (OTP/social only). Any derived secret uses strong hashing.
- PII and sensitive fields encrypted at rest; keys managed separately from data.
- Protected fields (Health, personal allowance) have the strongest access restrictions.

### In Transit
- TLS 1.2+ enforced for all traffic.
- HSTS configured; no plaintext endpoints.

## Data Minimization & Retention

- Only collect what the docs define (Wasla_03, Wasla_05).
- Retention schedules per Wasla_07: accounts, moderation, audit, logs.
- Deletion requests are honored per platform policy (account, data, media).

## Media Safety

- Images: real-photo check, duplicate detection, moderation (Wasla_15).
- Ephemeral photos: no download, no screenshot, no persistent caching beyond the viewing window (Wasla_05, Wasla_18).
- Media served through signed, expiring URLs.

## Fake Account Prevention

- No fake, real-looking accounts are ever created. The only sanctioned seed profiles are labeled Demo accounts (Wasla_04 §16a), which cannot be matched, messaged, or counted as real.
- Automated checks detect duplicate phones, reused photos, and synthetic-signal patterns; matches feed the Trust Engine (Wasla_14).
- Public aggregate counts always exclude demo accounts.

## Payments

- Payment data is handled by PCI-compliant processors; Wasla never stores card data.
- Idempotency keys prevent duplicate charges (Wasla_17, Wasla_21).
- Refunds and chargebacks are audited and tied to Trust (Wasla_17).

## Admin Security

- Admin access requires strong authentication, per-role scopes.
- **MFA is mandatory for all admin accounts** (TOTP or WebAuthn), enforced before any admin session and before any elevated action; service accounts use short-lived machine tokens instead of passwords.
- Sensitive admin actions require a second reviewer (Wasla_11, Wasla_20).
- Audit log is immutable and tamper-evident; reviewed regularly.
- Admin sessions have shorter expiry and activity timeouts.

## Cryptographic Key Management (F20)

- All encryption keys live in a managed secrets/KMS service, injected at runtime — never in code, config, images, or client.
- Envelope encryption: a data encryption key per service encrypts data; the DEK is itself wrapped by a key-encryption key in the KMS.
- Keys are versioned and rotated on a schedule (DEK rotation monthly, KEK rotation annually) with automatic re-wrap; old versions are retained only for decryption and retired.
- Access to the KMS is role-gated and audited; no key export to local machines or CI in production scope.
- Media URLs are signed and expiring (Wasla_22 §Media Safety); signing keys rotate and are never client-visible.

## Data Residency & Hosting (F20)

- **Primary hosting in Egypt** — member data (PII, profiles, messages) resides in the Egyptian jurisdiction; backups replicate within the same jurisdiction.
- No cross-border transfer of personal data without a documented legal basis; subprocessors are limited and covered by DPAs.
- Deletion obligations (Wasla_07) apply to all replicas and backups within policy time; backups are purged accordingly.
- The country selection used for matching (Wasla_08) is data, never a routing decision; hosting location is fixed by policy, not per-user.

## Incident Response

- Documented response plan: containment, investigation, notification, postmortem.
- Breach notification per platform policy and applicable law (notified to affected users without undue delay; regulator notification within legal timelines, e.g., 72 hours).
- Evidence preserved immutably for review.
- Incident severities (SEV1–SEV3) define escalation paths, on-call roles, and post-incident actions; drills are run periodically (Wasla_23).

## Threat Detection

- Rate limiting and abuse detection on auth, search, messaging (Wasla_21).
- Automated anomaly detection feeding the Trust Engine (Wasla_14).
- Suspicious activity (bulk scraping, brute force, chargebacks) triggers review.

## Incident Response

- Documented response plan: containment, investigation, notification, postmortem.
- Breach notification per platform policy and applicable law.
- Evidence preserved immutably for review.

## Golden Rule

Security protects member trust. No feature, convenience, or admin requirement overrides data protection, least privilege, or the user's right to privacy.

## Cross-References
- Philosophy → [Wasla_01](Wasla_01_Philosophy.md)
- Registration → [Wasla_03](Wasla_03_Registration.md)
- Data model & retention → [Wasla_07](Wasla_07_Data_Model.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Admin → [Wasla_20](Wasla_20_Admin_Panel.md)
- API → [Wasla_21](Wasla_21_API_Design.md)
- Roles & Permissions → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
- Deployment → [Wasla_23](Wasla_23_Deployment.md)
