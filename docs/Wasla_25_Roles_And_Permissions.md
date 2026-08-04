# Wasla 25 - Roles & Permissions

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Define platform roles, permissions, ownership boundaries, and the authorization model.

This document defines **who can do what**. Authentication (who you are) belongs to Registration (Wasla_03) and Security (Wasla_22).

## Guiding Principle

Every action in Wasla is authorized through roles and permissions rather than hardcoded user types.

## Core Actors

### Business Actors
- Visitor
- Account Owner
- Applicant
- Matched User

Note: The Applicant is not necessarily the logged-in user (guardian flows).

### Platform Roles
- User (member)
- Viewer (read-only)
- Moderator
- Verification Officer
- Customer Support
- Rule Admin
- Subscription Admin
- Administrator
- Super Administrator

These eight staff roles are canonical; Wasla_20 uses the same names. Future roles are added without code changes — they are configuration.

## Account Owner vs Applicant

- **Account Owner** can: register, log in, manage the applicant profile, receive notifications, purchase subscriptions.
- **Applicant** owns: personal information, photos, preferences, matching, verification.

This distinction affects the entire permission model (see Wasla_07).

## Permission Categories

- **Profile**: View, Create, Update, Delete, Archive.
- **Photos**: Upload, Delete, Reorder, Moderate.
- **Verification**: Request, Review, Approve, Reject.
- **Messaging**: Start Conversation, Reply, Report, Block.
- **Administration**: View Dashboard, Manage Users, Manage Master Data, Manage Rules, Manage Workflows, Manage Feature Flags, Manage Configuration.

## Permission Model

```
Role → Permission → Resource → Action
```

Examples:
- Moderator → Content → Review.
- Verification Officer → Verification → Approve.
- Rule Admin → Rule → Edit.

Avoid hardcoding permission checks in application logic.

## Role Matrix (canonical, least-privilege)

✓ = granted · ✓² = granted and is the approving/reviewing owner · — = not granted
(✓) = read-only within own scope · * = requires a documented/approved process

| Permission | Viewer | Moderator | Verification Officer | Customer Support | Rule Admin | Subscription Admin | Administrator | Super Administrator |
|---|---|---|---|---|---|---|---|---|
| View Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View queues (reports, moderation, appeals) | ✓ | ✓² | — | ✓ | — | — | ✓ | ✓ |
| Review content (text/photo) | — | ✓ | — | — | — | — | ✓ | ✓ |
| Override moderation decision | — | ✓²* | — | — | — | — | ✓ | ✓ |
| Review verification (selfie/ID) | — | — | ✓² | — | — | — | ✓ | ✓ |
| Approve / reject verification | — | — | ✓ | — | — | — | ✓ | ✓ |
| Search user (masked) | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| View protected/sensitive data | — | — | — | — | — | — | ✓* | ✓* |
| Restrict / ban user | — | ✓ | — | — | — | — | ✓ | ✓ |
| Handle refunds | — | — | — | ✓ (intake) | — | ✓² (approve) | ✓ | ✓ |
| Manage plans / pricing | — | — | — | — | — | ✓² | ✓ | ✓ |
| Manage master data | — | — | — | — | — | — | ✓ | ✓ |
| Create / edit / disable rules | — | — | — | — | ✓ | — | ✓ | ✓ |
| Sensitive rules (second reviewer) | — | — | — | — | ✓² (needs reviewer) | — | ✓ (reviewer) | ✓² |
| Manage workflows | — | — | — | — | — | — | ✓ | ✓ |
| Manage feature flags / configuration | — | — | — | — | ✓ (rules config) | ✓ (plans) | ✓ | ✓ |
| Manage roles | — | — | — | — | — | — | — | ✓² |
| View audit log | ✓ (own scope) | ✓ (own scope) | ✓ (own scope) | ✓ (own scope) | ✓ (rules) | ✓ (billing) | ✓ | ✓² (full) |

Notes:
- Matched User (business actor) owns conversation and mutual-interest actions only; it carries no staff permissions.
- Every ✓* access is audited in full and reversible only through the documented process.
- Refunds: Customer Support performs intake; Subscription Admin approves; both actions are audited.

## Resource-Based Authorization

Every permission targets a resource:

- Applicant
- Profile
- Photo
- Verification
- Message
- Subscription
- Rule
- Workflow
- Master Data

## Ownership Rules

Ownership is evaluated **before** permissions:

- An Account Owner may edit only the profiles they own.
- A Moderator cannot edit applicant preferences.
- An Administrator may manage configuration without changing applicant data.

## Engine Permissions

Each engine exposes its own permissions:

- Rule Engine: Create Rule, Edit Rule, Disable Rule.
- Workflow Engine: Create Workflow, Publish Workflow.
- Content Moderation Engine: Review Content, Override Decision.
- Matching Engine: View Statistics.

## Audit

Every privileged action is audited (Wasla_22 / audit logging): who, when, before, after, reason. Especially for verification, moderation, rule changes, workflow changes, feature flags, and configuration.

## Future Expansion

The model supports: custom roles, permission groups, delegated administration, regional administrators, read-only administrators, API clients, and AI service accounts — without redesigning authorization.

## Golden Rules

- Least privilege by default.
- Ownership is checked before permissions.
- Roles grant permissions, not business ownership.
- Every administrative action is auditable.
- Never hardcode permissions in application logic.
- Prefer configuration over code when assigning permissions.
- Authentication identifies the user; authorization determines what they may do.

## Cross-References
- Registration → [Wasla_03](Wasla_03_Registration.md)
- Data Model → [Wasla_07](Wasla_07_Data_Model.md)
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Rule Engine → [Wasla_11](Wasla_11_Rule_Engine.md)
- Trust Engine → [Wasla_14](Wasla_14_Trust_Engine.md)
- Admin Panel → [Wasla_20](Wasla_20_Admin_Panel.md)
- API Design → [Wasla_21](Wasla_21_API_Design.md)
- Security → [Wasla_22](Wasla_22_Security.md)
