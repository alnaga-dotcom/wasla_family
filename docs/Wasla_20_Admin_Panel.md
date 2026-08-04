# Wasla 20 - Admin Panel

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Admin Panel is the internal tool for operating Wasla: moderation, rule management, user support, subscriptions, and configuration. It exists to protect members and keep the platform healthy — never to expose member privacy beyond policy.

## Objectives

- Full oversight with least-privilege roles.
- Every action is logged, versioned, and reversible where applicable.
- Privacy is never bypassed by admin features except through a documented, approved process.
- Configuration-over-code: admins manage rules, weights, plans, and limits.

## Access & Roles

Roles are least-privilege and assigned by an authorized administrator. Names follow the canonical list in Wasla_25:

- Viewer (read-only)
- Moderator (content review, reports, appeals)
- Verification Officer (selfie/ID review)
- Customer Support (account help, refund intake)
- Rule Admin (visibility/validation/match/search rules)
- Subscription Admin (plans, pricing, refund approval)
- Administrator (users, master data, configuration, workflows, feature flags)
- Super Admin (roles, sensitive rules, system config, audit review)

Every role change is logged with owner and reason. No role may see protected data without a documented, approved process and a full audit trail.

## Core Areas

### 1. Moderation Queue
- Text items and photo AI decisions from the Content Moderation Engine (Wasla_15).
- Decisions: approve, reject with reason, escalate to human review.
- Full history per item; appeals from members land here (Wasla_09).
- Sensitive data never appears in moderation logs.

### 2. Rule Management
- Create, edit, enable/disable, test, version rules (Wasla_11).
- Sensitive rules require a second reviewer.
- Execution history viewable.

### 3. User Management
- Search a user by ID/phone/email (masked for non-authorized roles).
- Account states and workflow (Wasla_09).
- Trust score and trust events (Wasla_14).
- Restriction / ban actions are logged and require reason; members can appeal.

### 4. Reports & Appeals
- User reports (messaging, profiles).
- Appeals from automated or manual actions.
- Each item has a queue, priority, SLA, and decision history.

### 4a. Moderation SLA & Priorities (F18)

Items are queued with a computed priority; SLA targets define maximum handling time per priority:

| Priority | Examples | SLA target |
|---|---|---|
| P0 — Urgent | Safety-critical (harm, extortion, threats, impersonation reports) | Within 2 hours |
| P1 — High | Escalated review-range rejections, appeals | Within 24 hours |
| P2 — Normal | Standard photo/text queue items | Within 72 hours |
| P3 — Low | Resubmission reviews, non-urgent items | Within 7 days |

Rules:
- Priorities are computed from the moderation risk score (Wasla_15) plus report metadata; admins may re-prioritize, and every change is logged.
- SLA targets are configurable and monitored; breaches surface in the audit/reporting view.
- P0 items route to the on-call reviewer regardless of assignment; all other items can wait for assignment.

### 5. Subscription Management
- Plans, pricing, status (Wasla_17).
- Refund requests review.
- Billing history.

### 6. Configuration
- Feature flags.
- Notification limits (Wasla_16).
- Matching weights (Wasla_12).
- Search frequency limits (Wasla_19).
- Master data (Wasla_08).

### 7. Audit Log
- Immutable, tamper-evident log of admin actions (Wasla_22 Security).
- Searchable by admin, time, role, and target.

## Privacy & Safety Rules

- Sensitive data access requires a documented reason and elevated role.
- Bulk export of member data is prohibited for admin roles; only system export via Security protocol exists.
- No admin screen renders protected fields (Health, personal allowance) outside approved processes.
- Admin actions never weaken a user's privacy choice.

## Golden Rule

Admins operate the platform, not its members. Every action is logged, least-privilege is enforced, and member privacy outranks administrative convenience.

## Cross-References
- Roles & Permissions → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
- Workflow & appeals → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Rules → [Wasla_11](Wasla_11_Rule_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Subscriptions → [Wasla_17](Wasla_17_Subscription_System.md)
- Security → [Wasla_22](Wasla_22_Security.md)
- Website design → [Wasla_24](Wasla_24_Website_Design.md)
