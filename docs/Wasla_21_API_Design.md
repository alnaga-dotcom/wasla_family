# Wasla 21 - API Design

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Defines how Wasla's backend is exposed to clients (web, mobile, admin). The API is the single boundary between clients and domain engines, and it must enforce every privacy, validation, and rule decision defined in the docs.

## Objectives

- REST-style over HTTPS with consistent conventions.
- Privacy enforced at the API boundary, not only in the UI.
- Every mutation is validated, moderated, and auditable.
- Versioned to evolve without breaking clients.

## Layered Architecture

Controllers stay thin. Business decisions live in the engines:

```
Client → API Gateway → Auth → Controllers → Application Services → Business Engines → Repository
```

The API never decides business rules itself (can this profile publish, may this message send, is this applicant verified) — it delegates to the Rule / Workflow / Event engines and returns the result.

## Conventions

- Base URL: `https://api.wasla.app/v1`
- Content-Type: `application/json`
- Auth: Bearer token (see Security, Wasla_22)
- Language: `Accept-Language` header for localization (Wasla_08)
- Idempotency keys for purchases and critical mutations
- Pagination: `page` / `limit` on list endpoints

## Authentication & Session

- Login methods per Wasla_03: Google, Facebook, Phone (OTP), Email.
- Sessions are server-side, revocable, with rotation on sensitive actions.
- Token scopes: member scope and admin scope are never mixed.

## Payments

- Payment methods reuse the integrations used by 066.city: Egyptian mobile wallets (Vodafone Cash, Orange Cash, Etisalat Cash, and similar).
- Payment data is handled by PCI-compliant gateway; Wasla never stores wallet credentials or card data (Wasla_22).
- Idempotency keys prevent duplicate charges (Wasla_17).

## Endpoint Groups

### Member
- Auth: login, OTP verify, refresh, logout, account linking
- Profile: read/update own profile, field-level updates
- Onboarding: get next suggested group, completion nudges
- Discovery: recommendations feed, search, filters
- Matching: likes, mutual match, reasons, favorites
- Messaging: conversations, messages, ephemeral photos, block/report
- Notifications: list, preferences, mute
- Subscription: plans, purchase, manage, refund request
- Verification: selfie, status

### Admin (separate base path `/v1/admin`)
- Moderation queue, decisions, history
- Rules: CRUD, test, version history
- Users: lookup, state changes, restrictions
- Reports & appeals
- Subscription management, refunds
- Audit log search
- Configuration

## Privacy in Responses

- Field-level: the response shape depends on the viewer's permissions and the relationship between viewer and target (Wasla_05 privacy).
- Protected fields are omitted from payloads, not returned empty or null with hints.
- Sensitive values (Health, personal allowance) never appear in list endpoints.
- Pagination metadata never leaks counts of hidden fields.

## Validation & Moderation

- Every text input passes Content Moderation (Wasla_15) before storage.
- Field validation matches Rule Engine rules (Wasla_11), never duplicated in controllers.
- A rejected value returns a clear, localized error and does not persist partial data.

## Errors

- Consistent error envelope: `{ "code", "message" (localized), "field", "ref" }`.
- HTTP status per standard semantics (400, 401, 403, 404, 409, 422, 429).
- Errors never leak internal details, stack traces, or existence hints for sensitive resources.

## Rate Limits

- Per-endpoint limits (configurable) with `429` + `Retry-After`.
- Stricter limits for auth, search (Wasla_19), and message sending.
- Violations feed the Trust Engine (Wasla_14).

## Auditing

- All mutations are auditable via the Event Engine (Wasla_10).
- Idempotency keys prevent duplicate purchases and double-sends.

## Golden Rule

The API never trusts the client: it re-applies validation, moderation, and privacy rules on every request, and returns only what the viewer is allowed to see.

## Cross-References
- Registration & sessions → [Wasla_03](Wasla_03_Registration.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Rules → [Wasla_11](Wasla_11_Rule_Engine.md)
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Roles & Permissions → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
- Security → [Wasla_22](Wasla_22_Security.md)
