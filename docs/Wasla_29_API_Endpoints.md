# Wasla 29 - API Endpoints

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Concrete enumeration of every REST endpoint behind Wasla_21's gateway. This is the contract the web, mobile, and admin clients consume. Conventions, errors, privacy, and rate limits are defined in [Wasla_21](Wasla_21_API_Design.md) and not repeated here.

## Conventions Recap

- Base: `https://api.wasla.app/v1` · Admin: `https://api.wasla.app/v1/admin`
- `Content-Type: application/json` · Bearer auth · `Accept-Language` for localization
- Idempotency keys: all purchases, all `POST` mutations
- Pagination: `page` / `limit` on all list endpoints
- Errors: envelope `{ code, message, field, ref }` (Wasla_21 §Errors)

## Member Endpoints

### 1. Auth & Session (Wasla_03, Wasla_22)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Start login (Google, Facebook, Phone OTP, Email) |
| POST | `/auth/otp/verify` | Verify OTP, issue session |
| POST | `/auth/refresh` | Rotate access token |
| POST | `/auth/logout` | Revoke session |
| POST | `/auth/verify/token` | Re-issue token after sensitive action (rotation) |
| GET | `/auth/me` | Own session & account state |

### 2. Onboarding & Profile (Wasla_03, 04, 05)

| Method | Path | Purpose |
|---|---|---|
| GET | `/onboarding/step` | Next suggested profile group (tier order, Wasla_05 §9b) |
| GET | `/profile/me` | Own profile (full, includes private fields) |
| PATCH | `/profile/me` | Field-level update (validation via Wasla_06/11) |
| GET | `/profile/completion` | Own completion % + missing checklist (Wasla_05 §9e) |
| POST | `/profile/verify/selfie` | Selfie verification attempt (Wasla_04 Verification group) |
| GET | `/profile/verify/status` | Verification status + reasons |
| POST | `/profile/photo` | Upload photo (goes to moderation queue, Wasla_15) |
| DELETE | `/profile/photo/{id}` | Remove own photo |
| PATCH | `/profile/photo/{id}` | Reorder / set as primary |

### 3. Discovery & Search (Wasla_13, Wasla_19)

| Method | Path | Purpose |
|---|---|---|
| GET | `/discovery/recommendations` | Ranked recommendation feed |
| POST | `/discovery/recommendations/seen` | Mark viewed (affects freshness/rank) |
| GET | `/search` | Manual search (text-first, no big photos — Wasla_24) |
| GET | `/search/filters` | Available filter options (from Master Data, Wasla_08) |
| POST | `/search/filters/save` | Save a search filter set |

### 4. Matching (Wasla_12, Wasla_27)

| Method | Path | Purpose |
|---|---|---|
| GET | `/matches/available` | Available matches (Viewed→Available transitions) |
| POST | `/matches/{id}/like` | Express interest (→ Interested) |
| POST | `/matches/{id}/pass` | Pass (per Pass rules, Wasla_27) |
| GET | `/matches/{id}/reasons` | Match reasons for a Mutual |
| GET | `/matches/mutual` | List of mutual matches (→ Conversation-eligible) |
| GET | `/matches/archived` | Archived matches |
| POST | `/matches/{id}/archive` | Archive a match (terminal, recoverable) |
| POST | `/matches/{id}/block` | Block member (Match terminal → Blocked state) |
| POST | `/favorites/{id}` | Add to favorites |
| DELETE | `/favorites/{id}` | Remove from favorites |
| GET | `/favorites` | List favorites |

### 5. Messaging (Wasla_18)

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations` | Conversation list |
| POST | `/conversations/{id}/open` | Open with Premium (gate is mutual like only) |
| GET | `/conversations/{id}/messages` | Message history |
| POST | `/conversations/{id}/messages` | Send message (moderated, Wasla_15) |
| POST | `/conversations/{id}/messages/{mid}/read` | Mark read |
| POST | `/conversations/{id}/photo-ephemeral` | Send ephemeral photo |
| DELETE | `/conversations/{id}` | Delete conversation |
| POST | `/messages/contact-share` | Paid structured contact sharing (Wasla_18) |
| POST | `/block/{memberId}` | Block member (from chat) |
| POST | `/report/{memberId}` | Report member |

### 6. Notifications (Wasla_16)

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Notification list |
| POST | `/notifications/{id}/read` | Mark read |
| PUT | `/notifications/preferences` | Channel/type preferences |
| PUT | `/notifications/mute` | Mute durations |

### 7. Subscription & Payments (Wasla_17)

| Method | Path | Purpose |
|---|---|---|
| GET | `/subscription/plans` | Plans & current promo (Wasla_17) |
| POST | `/subscription/purchase` | Purchase (idempotency key required) |
| POST | `/subscription/switch` | Change plan/tier |
| GET | `/subscription/manage` | Manage active subscription |
| POST | `/subscription/refund-request` | Request refund (human review) |
| GET | `/subscription/status` | Feature entitlements for the viewer |

### 8. Trust & Account State (Wasla_14)

| Method | Path | Purpose |
|---|---|---|
| GET | `/trust/me` | Own trust level + contributing factors + improvement steps |
| POST | `/appeals` | Appeal an automatic action (Wasla_09) |
| GET | `/appeals/{id}` | Appeal status |

## Admin Endpoints (`/v1/admin`, Wasla_20, Wasla_25)

Roles enforce permission matrix (Wasla_25); every admin action is audited.

### 9. Moderation (Wasla_15)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/moderation/queue` | Pending items by type/priority |
| POST | `/admin/moderation/{id}/approve` | Approve (photo/text) |
| POST | `/admin/moderation/{id}/reject` | Reject with reason |
| GET | `/admin/moderation/history` | Decision history |
| POST | `/admin/moderation/assign` | Assign item to reviewer |

### 10. Rules & Configuration (Wasla_11, Wasla_06, Wasla_08)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/rules` | List rules |
| POST | `/admin/rules` | Create rule (Draft) |
| PUT | `/admin/rules/{id}` | Update rule |
| POST | `/admin/rules/{id}/publish` | Publish (versioned) |
| POST | `/admin/rules/{id}/test` | Test against sample data |
| GET | `/admin/rules/{id}/versions` | Version history |
| GET | `/admin/config` | Configuration snapshot |
| PUT | `/admin/config` | Update configuration (versioned) |

### 11. Users (Wasla_25)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users` | Search/lookup users |
| GET | `/admin/users/{id}` | User detail (role-limited) |
| POST | `/admin/users/{id}/state` | Suspend / lift (UserSuspended/Lifted events) |
| POST | `/admin/users/{id}/restriction` | Apply/remove restriction |

### 12. Reports & Appeals (Wasla_09)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/reports` | Report queue |
| POST | `/admin/reports/{id}/decision` | Confirm / dismiss (trust impact only after confirm) |
| GET | `/admin/appeals` | Appeal queue |
| POST | `/admin/appeals/{id}/decision` | Resolve appeal |

### 13. Subscription & Finance (Wasla_17)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/subscriptions` | Subscription overview |
| POST | `/admin/subscriptions/{id}/override` | Manual override (audited) |
| GET | `/admin/refunds` | Refund requests |
| POST | `/admin/refunds/{id}/decision` | Approve / decline refund |

### 14. Audit (Wasla_10, Wasla_22)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/audit` | Search audit log (role-limited) |
| GET | `/admin/audit/export` | Export (admin-only) |

## Privacy Rules in Payloads

- Response shape depends on viewer permission + relationship (Wasla_05 privacy, Wasla_25).
- Protected fields are **omitted**, never `null` with hints (Wasla_21 §Privacy).
- Sensitive values (Health, personal allowance) never appear in list endpoints.
- `GET /search` and list endpoints never return contact info or exact location.
- Trust score is returned as a level + factors, never the raw formula or number (Wasla_14).

## Validation & Moderation

- Every text mutation passes Content Moderation (Wasla_15) before storage.
- Rule Engine (Wasla_11) validates values; controllers never duplicate rules.
- Idempotency keys required on all purchases and critical mutations.

## Golden Rule

Every endpoint returns only what the viewer is permitted to see, re-validates every input through the engines, and leaves a complete audit trail.

## Cross-References
- Conventions & errors → [Wasla_21](Wasla_21_API_Design.md)
- Auth & registration → [Wasla_03](Wasla_03_Registration.md)
- Matching lifecycle → [Wasla_27](Wasla_27_Match_Workflow.md)
- Privacy field levels → [Wasla_05](Wasla_05_Profile_Fields.md)
- Permissions matrix → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
- Events & audit → [Wasla_10](Wasla_10_Event_Engine.md)
