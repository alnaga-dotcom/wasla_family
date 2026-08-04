# Wasla 14 - Trust Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
The Trust Engine measures account reliability and protects the platform by assigning a dynamic Trust Score.

## Objectives
- Increase user confidence
- Reward genuine members
- Reduce fraud
- Support ranking and moderation

## Trust Dimensions

Trust is multidimensional — never a single "verified" badge:

- **Identity Trust** — phone / email / ID verified.
- **Profile Trust** — completion, consistency, real photos, accuracy.
- **Behavior Trust** — reports, blocking rate, spam detection, policy violations.
- **Activity Trust** — recent login, active usage, long-term membership.
- **Verification Trust** — outcomes of the Verification process (a separate system, Wasla_04 §16).

The overall score is composed from these dimensions; the Formula Engine calculates it and the Trust Engine interprets the inputs.

## Rule Engine Integration

The Trust Engine **provides** trust data. The Rule Engine **decides** how to use it (minimum trust to message, visibility thresholds, feature eligibility). The Trust Engine never applies those policies itself.

## Trust Factors

Positive:
- Email verified
- Phone verified
- Selfie verified
- Complete profile
- High-quality photos
- Recent activity
- Positive history
- Long account age

Negative:
- Reports
- Spam behavior
- Fake photos
- Frequent blocks
- Policy violations

## Trust Score

Range: 0–100

Suggested Levels:
- 90–100 Excellent
- 70–89 Good
- 50–69 Fair
- Below 50 Low

## Usage

Trust Score influences:
- Recommendation ranking
- Search ranking
- Profile quality
- Moderation priority
- Feature eligibility

## User-Facing Trust

The user sees:
- A trust level (e.g., Excellent / Good / Fair / Low) on their own account.
- A verification badge to other members, never the raw number.
- Which verifications and actions raised their trust.
- Which areas need improvement, with concrete steps ("Verify your phone", "Add a photo", "Complete your profile").

The raw formula is never exposed, but every effect on the user is explainable and actionable.

## Negative Effects Require Human Review

Actions that lower trust (spam, fake photos, policy violations) never apply automatically:
- They are flagged for review.
- A human confirms or dismisses the flag.
- The trust change only applies after confirmation.
- The affected user is told what happened and how to appeal.

## Automatic Actions & Appeals

Examples:
- Require manual review
- Limit messaging
- Hide from recommendations
- Request additional verification

Every automatic action:
- Is communicated to the user with a reason.
- Can be appealed (per Wasla_09 appeal workflow).
- Is lifted automatically when the underlying issue is resolved.

## Event Integration

Recalculate after:
- VerificationPassed / VerificationFailed / VerificationExpired
- PhotoApproved / PhotoRejected
- ProfileCompleted / ProfileUpdated
- UserReported / ReportResolved
- BlockAdded / BlockLifted
- UserSuspended / UserSuspendedLifted
- SubscriptionActivated / SubscriptionCancelled
- ChargebackReceived (post human review)
- SessionActive / AccountPaused / AccountResumed
- Every change publishes TrustScoreChanged (Wasla_10).

## Admin Configuration

Configurable:
- Factor weights
- Thresholds
- Automatic actions

## Automatic Actions

Examples:
- Require manual review
- Limit messaging
- Hide from recommendations
- Request additional verification

## Design Rules

- Trust is independent from compatibility.
- Never expose the raw formula.
- Recalculate incrementally.
- Log every score change.
- The user can always see their own level, the contributing factors, and how to improve.
- Negative changes are human-reviewed before they apply, and appealable after.

## Golden Rule

Trust is earned over time through positive behavior and successful verification, not simply by completing registration.

Second rule: trust must protect users from the platform, not only the platform from users. Every effect is explainable, human-reviewed when negative, and appealable.

## Cross-References
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Workflow & appeals → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Recommendation → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Content Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Admin Panel → [Wasla_20](Wasla_20_Admin_Panel.md)
