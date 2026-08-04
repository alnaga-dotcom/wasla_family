# Wasla 09 - Workflow Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Workflow Engine manages the lifecycle of every major entity inside Wasla.

Instead of allowing arbitrary state changes, every entity follows a predefined workflow.

## Responsibilities & Boundaries

- The Workflow Engine controls **when** an entity may move to another state.
- The Rule Engine decides **whether** the move is allowed (validation before transition).
- The Event Engine announces that the move has happened.

The Workflow Engine never makes business decisions, sends notifications, or calculates matches itself.

## Objectives

- Predictable behavior
- Easy auditing
- Consistent business rules
- Better automation
- Event generation
- Future scalability

## Core Concepts

State

Current condition of an entity.

Transition

Movement from one state to another.

Workflow

A collection of valid states and transitions.

Transition Rule

Conditions required before a transition is allowed.

---

# Account Workflow

Registered

↓

Phone Verified (account key)

↓

Email Verified (optional, only if email was provided)

↓

Profile Started

↓

Profile Completed

↓

Verified

↓

Inactive (user-paused)

↓

Reactivated (inactive → active again)

↓

Suspended (policy violation)

↓

Deleted

Branches:
- Suspended → Appeal → Reactivated OR Stay Suspended
- Inactive ↔ Reactivated: the user may pause and resume from any active state (not only Verified); this is the canonical AccountPaused / AccountResumed pair (Wasla_10).
- Suspension uses the canonical UserSuspended / SuspensionLifted pair (Wasla_10); "Reactivated" in this diagram means AccountResumed for pause and SuspensionLifted for suspension.
- Premium is a subscription state, not an account state (see Subscription Workflow).

---

# Photo Workflow

Uploaded

↓

AI Review

↓

Approved

↓

Visible

OR

Uploaded

↓

AI Review

↓

Manual Review

↓

Approved

OR

Manual Review

↓

Rejected

OR

Visible (user hides photo) → Hidden → Restored

Rejected photos may be replaced by re-uploading a new photo (Rejected → Uploaded).

---

# Verification Workflow

Pending

↓

Processing

↓

Passed

OR

Failed

OR

Expired

Retry: Failed → Pending and Expired → Pending (re-submit), subject to anti-abuse rate limits.

Events: VerificationPassed / VerificationFailed / VerificationExpired (Wasla_10); granular PhoneVerified / EmailVerified / SelfieVerified track the underlying step.

---

# Subscription Workflow

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
- Active → Cancelled (manual cancel, user-initiated; event SubscriptionCancelled, Wasla_10)
- Cancelled stays valid until the end of the paid period, then Expired.
- Payment failures and refunds emit PaymentFailed / PaymentRefunded (Wasla_10) and never change entitlement directly — they are workflow transitions, not direct status updates.

---

# Report Workflow

Open

↓

Under Review

↓

Resolved

OR

Dismissed

OR

Appealed (reporter or reported user challenges the outcome) → Re-Review → Resolved OR Dismissed

---

# Content Moderation Workflow (Text)

Submitted

↓

Auto Review

↓

Accepted

OR

Submitted

↓

Auto Review

↓

Manual Review

↓

Approved

OR

Submitted

↓

Auto Review

↓

Manual Review

↓

Rejected (with user-visible reason)

Rejected content can be edited and resubmitted. Every decision is reversible on appeal.

---

# Appeal Workflow

Any enforcement decision (suspension, content rejection, verification failure, report outcome) can be appealed:

- Appeal
- Re-Review (human)
- Overturned → previous state restored
- Upheld → original decision stands

Appeals are audited and time-bounded.

---

# Transition Requirements

Every transition should define

- Source State
- Target State
- Conditions
- Allowed Roles
- Trigger Event
- Notifications
- Audit Entry
- User-Facing Message (what the user is told and why)
- Appeal Eligibility (whether the outcome can be challenged)
- Timeout / Expiry (if the state can lapse, e.g., verification or subscription)

# Manual vs Automatic Transitions

Support both:
- **Manual** — Admin approval, moderator review, human verification.
- **Automatic** — OTP expiry, subscription expiry, verification timeout, profile completed.

# Failure Handling

If a transition fails:
- The state remains unchanged.
- The failure is logged.
- An error event is generated.
- Retry policies apply where appropriate.
- Entities are never left in an undefined state.

# Workflow Versioning

Workflows evolve. Support Draft → Published → Archived. Existing entities continue using the workflow version under which they were created until migration is planned.

---

# State History

Every workflow-enabled entity must store

- Current State
- Previous State
- Transition Time
- Changed By
- Reason (optional)

---

# Integration

Each successful transition should publish an event.

Example

ProfileCompleted

VerificationPassed

SubscriptionActivated

PhotoApproved

---

# Benefits

- Simpler business logic
- Better monitoring
- Easier debugging
- Cleaner APIs
- Better reporting

---

# Golden Rule

Never update entity status directly.

Always execute a workflow transition.

Every workflow outcome that affects a user must be explainable and appealable.

## Cross-References
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Rules → [Wasla_11](Wasla_11_Rule_Engine.md)
- Content Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Subscription → [Wasla_17](Wasla_17_Subscription_System.md)
