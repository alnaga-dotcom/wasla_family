# Wasla 16 - Notification Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Notification Engine delivers timely, relevant, and respectful notifications to members. It is a consumer of the Event Engine (Wasla_10) and the only component that decides what a user is told and how.

## Responsibility Boundary

The Notification Engine is a **delivery engine**, not a decision engine:
- Events create notification opportunities (Wasla_10).
- The Rule Engine decides whether a notification should be sent and to whom.
- The Notification Engine decides only how to deliver it (channel, timing, template).

It never makes business decisions, and it never generates business events itself.

## Notification Priorities

- Critical — password change, login alert (always delivered, security channels non-negotiable).
- High — verification approved, new message.
- Normal — new match, like.
- Low — weekly digest, suggestions.

Priority affects delivery strategy (immediate vs batched vs scheduled).

## Notification Templates

Every notification uses a template: Template ID, language, channel, variables, version (localized per Wasla_08). Templates contain presentation — never business logic.

## Objectives

- Deliver the right notification at the right time.
- Avoid notification fatigue.
- Respect user preferences and privacy.
- Support multiple channels (in-app, push, email).
- Keep every notification explainable and actionable.

## Notification Sources

Notifications are derived from events (Wasla_10), never from screens directly:

- Likes and matches
- New messages
- Favorites
- Profile views (per privacy policy)
- Verification results
- Moderation results
- Subscription status
- Profile completion nudges
- Account security alerts
- Saved search results (V1+, per Wasla_19 saved searches)

## Desired Partner Notifications

Notifications related to the Desired Partner group (Wasla_04 §13) follow the gentleness principle — they inform, never pressure:

- New match for a preference dimension: "A profile matches your preference for a housewife" — only when the preference was explicitly set, never for TELL_LATER or NO_PREFERENCE values.
- Soft mismatch is never announced as rejection; it is surfaced only in the match card as "you two can talk about this".
- Preference completion nudges are limited and explain the benefit ("Adding your smoking preference improves your matches").
- No notification ever mentions protected values (health, personal allowance, medical barrier).
- The user can mute preference-related nudges entirely, without muting transactional messages.

## Completion & Verification Nudges

- One nudge per session, in-app, never push, never repeated.
- Ordered by tier (Wasla_05 §9b): photo → selfie → profession → sensitive.
- Benefit-based phrasing: "Add your photo — profiles with photos get more matches", "Verify with a selfie — you'll be seen and asked more".
- Sensitive values (health, personal allowance, medical barrier) are never mentioned.
- Verification is framed as an achievement, not a duty.
- The user can mute completion nudges without muting transactional notifications.

## Notification Types

- Transactional (likes, messages, verification results) — always relevant.
- Informational (subscription expiry, privacy changes) — required by policy.
- Promotional (offers, campaigns) — optional, opt-in only.
- Educational (profile completion nudges) — limited and sparing.

## Delivery Channels

- In-app notification center (always)
- Push notifications (opt-in, per type)
- Email (for account security and billing only in V1)

**Privacy-change notifications (F17)**: in V1, informational notifications about privacy or policy changes are delivered **in-app only** (notification center), never by email; email stays reserved for account security and billing. If a legal/regulatory notice requires it, it is treated as a security-class email, not a marketing one.

Push and email are never used for promotional content unless the user opted in.

## Consent & Preferences

Users control notifications by type and channel:

- Likes
- Messages
- Matches
- Promotions
- Email security alerts (non-negotiable, always on)

Preferences are stored per user and per type, configurable at any time, and never reset silently.

## Anti-Fatigue Rules

- No user receives more than a configurable number of notifications per day.
- Duplicate notifications for the same event are suppressed.
- Notifications are batched (e.g., "5 new likes") instead of sent individually.
- Promotional notifications are strictly limited and time-boxed.
- The user can mute a category entirely.

## Notification Content

Every notification is:
- Actionable (opens the relevant screen).
- Explainable (why this notification appeared).
- Non-deceptive (never mimics a message or a human).

Sensitive data is never revealed in a push or preview (per Wasla_05 privacy).

## Workflow & Appeals

- Account security and moderation notifications are mandatory, with a link to appeal where applicable (Wasla_09).
- A user can report a notification as abusive, which is reviewed by a human.

## Events & History

Each sent notification is recorded for audit and analytics, referencing the originating event without duplicating its content insecurely.

## Golden Rule

Notifications are a tool to serve the member, not a channel for the platform's noise. Every notification must be relevant, explainable, and respectful of user choice.

Second rule: no screen sends notifications directly; the Notification Engine derives everything from events.

## Cross-References
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Trust & appeals → [Wasla_14](Wasla_14_Trust_Engine.md)
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Website design → [Wasla_24](Wasla_24_Website_Design.md)
