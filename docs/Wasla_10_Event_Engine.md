# Wasla 10 - Event Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
The Event Engine is the communication backbone of Wasla.
Every important business action publishes an event that can be consumed by independent services.

## Objectives
- Loose coupling
- Event-driven architecture
- Asynchronous processing
- Better scalability
- Analytics
- AI readiness

## Core Principles
- Publish facts, not commands.
- Events are immutable.
- One publisher, many consumers.
- Every business action should emit an event.
- Every user-visible outcome must be traceable to the event that produced it.
- Every transition in the Workflow Engine publishes the corresponding event.

## Event Categories

### User
- UserRegistered
- UserLoggedIn
- UserDeleted
- AccountPaused (canonical for user pause; Wasla_09 "Inactive/Reactivated")
- AccountResumed
- UserSuspended (canonical for policy suspension)
- SuspensionAppealed
- SuspensionLifted

### Profile
- ProfileCreated
- ProfileUpdated
- ProfileCompleted
- ProfilePublished
- ProfileHidden

### Photo
- PhotoUploaded
- PhotoApproved
- PhotoRejected
- PhotoHidden
- PhotoRestored
- PhotoReplaced

### Verification
- PhoneVerified
- EmailVerified
- SelfieVerified
- VerificationPassed (generic pass; used by Wasla_09/14/24)
- VerificationFailed
- VerificationExpired

### Matching
- MatchCalculated
- MatchUpdated
- MatchAvailable
- MatchViewed
- MatchMutual
- MatchArchived

### Recommendation
- RecommendationGenerated

### Interaction
- ProfileViewed
- FavoriteAdded
- FavoriteRemoved
- LikeSent
- LikeWithdrawn
- BlockAdded
- BlockRemoved
- ConversationStarted
- MessageSent
- MessageBlocked

### Social Safety
- UserReported
- ReportResolved
- ReportAppealed
- AppealOverturned
- AppealUpheld

### Subscription
- SubscriptionPurchased
- SubscriptionActivated
- SubscriptionExpired
- SubscriptionRenewed
- SubscriptionCancelled
- PaymentFailed
- PaymentRefunded

### Moderation
- ReportSubmitted
- ContentRejected
- ContentFlaggedForReview
- ContentEditedAndResubmitted

### Trust
- TrustScoreChanged

## Standard Event Schema

Every event should contain:

- EventId
- EventType
- EventVersion
- TimestampUTC
- UserId
- ProfileId
- EntityType
- EntityId
- CorrelationId
- Source
- Metadata (JSON)

## Event Consumers

Typical consumers include:

- Workflow Engine
- Rule Engine
- Matching Engine
- Recommendation Engine
- Notification Engine
- Trust Engine
- Content Moderation Engine
- Analytics
- Audit Log

## Event Outbox & Delivery (F5)

- **Outbox pattern**: a business mutation and its event are written atomically to the event outbox; a dispatcher publishes reliably (at-least-once delivery). No event is published unless its source mutation committed.
- **Ordering**: events of the same entity are ordered by `TimestampUTC` + sequence; cross-entity events have no global order guarantee.
- **Idempotent consumers**: consumers deduplicate by `EventId` (replays and retries are safe).
- **Schema evolution**: events carry `EventVersion`. Consumers accept the versions they understand and skip or migrate unknown ones. Producers may add fields (backward compatible) but never rename or repurpose a field within the same version; breaking changes require a new `EventVersion` with a documented migration.

## Failed Processing

Consumers should retry failed events without affecting other consumers.

## Event Store

All events should be stored for:

- Auditing
- Debugging
- Replay
- Analytics
- AI Training

### Event Store Privacy

- Events are retained according to a configurable retention policy, not forever.
- Personally identifiable content inside events is masked or purged after the legal retention period.
- Event logs never include data that a user has been told is protected (e.g., health disclosures).
- Account deletion follows the data deletion rules of Wasla_07: personal linkage is removed while audit requirements remain satisfied.

## Golden Rule

Nothing important should happen inside Wasla without publishing an event.

## Cross-References
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Recommendation → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
