# Wasla 17 - Subscription System

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Subscription System manages plan offerings, purchases, activation, renewal, expiry, and cancellations. It is a separate domain from the account lifecycle (Wasla_09) and is driven by events.

## Objectives

- Clear, honest plan communication.
- Reliable billing lifecycle.
- No silent charges or expiries.
- Revenue without harming trust.

## Plans

Plans are configurable from the Admin Panel:

- Plan ID and code
- Name (localized)
- Duration (monthly / yearly)
- Price (per currency)
- Included features
- Status (active / inactive)

## Pricing (Egypt — V1)

| Duration | Price | Regular price |
|---|---|---|
| Introductory offer (عرض تقديمي) | EGP 0 | EGP 199 |
| Monthly | EGP 299 | EGP 599 |
| Quarterly (3 months) | EGP 499 | EGP 999 |

- Launch promo: the new price is shown alongside the crossed-out regular price, clearly labeled as a promo and time-boxed from the Admin Panel.
- A completion-based discount is available in addition: a member with a completed profile (per Wasla_05 §9 completion criteria) qualifies for a discount, applied at purchase time. The exact discount is configurable from the Admin Panel. The Completion Steps checklist (Wasla_05 §9e) helps members see exactly how to reach the discount threshold.
- Prices are configurable and can be adjusted without code.

Feature eligibility (boosts, unlimited likes, visibility, structured "Share contact" action) is consumed by other engines through configuration, never hardcoded. "Share contact" is the structured, recorded, in-app premium action defined in Wasla_18 — never free-text contact exchange, which stays blocked for everyone.

## Entitlement Model

Engines never ask "is the user Premium?". They ask: **does this account have the required entitlement?**

```
Subscription → Plan → Features → Entitlements → Rule Engine → Action
```

This allows new plans, promotions, regional offerings and temporary access without changing application logic.

## Feature Flags Integration

Every commercial feature respects Feature Flags: if "Profile Boost" is OFF, it is unavailable to everyone, including premium members. Feature availability belongs to Feature Flags; feature behavior belongs to Configuration.

## Billing Provider Independence

Payment providers remain behind an adapter layer (Egyptian mobile wallets in V1). The Subscription System never depends on a specific provider, so providers can be added or replaced without business changes.

## Revenue Model (Freemium)

Free tier is time-limited, with the duration configurable from the Admin Panel (not permanent). During the free period:
- Likes: 5 per day.
- Messages: 5 per day for the sender; replying to an incoming message does not consume quota.
- When the free period ends, members move to the paid model (full features).

The monetization model is adapted from the 066.city platform (business model borrowed and modified for Wasla's gentleness principles). Payment methods reuse the same providers/integrations used by 066.city: Egyptian mobile wallets (Vodafone Cash, Orange Cash, Etisalat Cash, and similar wallet providers) via a supported payment gateway.

Premium features (configurable plans + credits):
- Unlimited likes and messages.
- "Who liked you" views.
- Organized medical-barrier disclosure.
- Boost (visibility purchase) via credits:
  - Bought with in-app credits; one Boost = 49 EGP equivalent.
  - Volume options (3 = 119, 5 = 179) — configurable.
  - Boost raises profile visibility in recommendations/search for a defined period.
  - A Boost is never required to be seen; it only increases visibility within the existing quality rules.

All quotas and the free-period duration are configurable from the Admin Panel (never hardcoded).

No ads inside conversations, no hiding essential decision facts (e.g., marital status), no selling "better matching".

## Billing Lifecycle (Workflow)

Pending
  ↓
Paid
  ↓
Active
  ↓
Expired
  ↓
Renewed

Branches:
- Pending → Cancelled (user abandons payment)
- Active → Cancelled (user cancels; remains active until period end)
- Renewal Failure → Expired with grace period (configurable), then notifies user before loss of features

## Purchase Flow

1. User selects a plan.
2. User confirms and pays.
3. Payment is recorded (Payment entity, Wasla_07).
4. Subscription becomes Active.
5. Event SubscriptionPurchased + SubscriptionActivated published (Wasla_10).

## Renewal

- Automatic renewal is explicit and communicated before the charge.
- Renewal notices are sent before the billing date.
- The user can cancel automatic renewal at any time, with the plan continuing until the paid period ends.
- No hidden charges and no retroactive pricing changes.

## Expiry & Grace

- Expiry is preceded by notices.
- A configurable grace period keeps features while payment is retried.
- After grace, features are downgraded, never silently removed without explanation.

## Refunds

- Refund requests are reviewed by a human.
- Approved refunds publish PaymentRefunded and revert subscription state accordingly.
- Refund policy is clearly displayed at purchase time.

## Trial & Promotions (Future)

- Free trials and promotional plans are configurable, time-boxed, and clearly labeled.
- Promotions never auto-convert to paid without explicit consent.

## Fraud & Trust

- Payments are linked to the account's Trust Engine (Wasla_14).
- Chargeback and fraud events lower trust and can gate further purchases.
- Billing events are auditable and appealable per Wasla_09.

## Transparency

- Users always see their current plan, renewal date, price, and next charge.
- Users always see which features they lose on downgrade, before the downgrade happens.
- No expiry happens without prior notice.

## Golden Rule

Subscriptions must be honest and predictable. The user always knows what they pay, when, and what happens next — before it happens.

Second rule: the subscription lifecycle is a workflow, never direct status updates.

## Cross-References
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Website design → [Wasla_24](Wasla_24_Website_Design.md)
