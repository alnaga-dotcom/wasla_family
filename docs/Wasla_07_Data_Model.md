# Wasla 07 - Data Model

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
Define the logical data model for Wasla before any database implementation.

## Design Philosophy

Use a Hybrid Model:
- Core searchable attributes -> Static columns
- Flexible attributes -> Dynamic fields
- Repeatable entities -> Separate tables

## Core Entities

### Account
Authentication, account status, subscription reference. The Account is the login identity.

### Applicant (Profile Owner)
The person whose marriage profile is created — may or may not be the Account Owner.

### Account → Applicant Relationship
How the applicant relates to the account owner: SELF / FATHER / MOTHER / BROTHER / SISTER / SON / DAUGHTER / GUARDIAN / OTHER.
- Stored once at registration (Wasla_03).
- Not part of the applicant profile, never matched.
- V1 is one Account → one Applicant; the model supports more in the future.

### Profile
Marriage profile and core searchable attributes. Always belongs to the Applicant, never the Account Owner.

### ProfilePhoto
Applicant photos with privacy and moderation status.

### Verification
Phone, email, selfie and future identity verification. Verification status belongs to the Applicant.

### PartnerPreference
Desired partner values and ranges.

### HardRule
Non-negotiable partner requirements.

### Match
Compatibility result between two profiles.
Matching is bidirectional: the model stores the relationship between two profiles, not a one-directional judgment.

### SensitiveData
Protected data (e.g., health disclosures):
- Never used in matching, ranking, or search.
- Only user-initiated.
- Covered by explicit retention and deletion rules.

**Sensitive classification** (F6): a field is Sensitive when it (a) is disclosed voluntarily under a privacy guarantee, (b) could cause discrimination or stigma if leaked, or (c) reveals a medical, financial, or family vulnerability. The explicit list lives in Wasla_05 field definitions (Health domain, personal allowance, medical barrier, chronic conditions, and any field marked `TELL_LATER`). Classification is assigned at field definition time (Wasla_06), never at runtime by a rule; a field must be declared Sensitive to be treated as one. New sensitive fields require the elevated approval path of Wasla_11.

Sensitive data is stored with encryption at rest (Wasla_22), excluded from event payloads (Wasla_10), excluded from API responses except to the owner (Wasla_29), and never logged.

### MatchReason
Human-readable explanation for compatibility.

### RecommendationHistory
Tracks profile recommendations shown to users.

### ProfileView
Stores profile visits.

### Conversation
Conversation metadata between two ProfileIds:
- ConversationId, ProfileA, ProfileB
- State (lifecycle per Wasla_18: Not Started → Invitation → Active → Muted → Archived → Closed → Deleted soft)
- StartedAt, LastActivityAt, LastMessagePreview (masked — never sensitive content)
- OpenFlags (who may open; gate = mutual like only, Wasla_18)

### Message
Individual messages:
- MessageId, ConversationId, SenderId
- Content (moderated before storage, Wasla_15), ContentType (text / ephemeral photo / structured contact share)
- SentAt, ReadAt
- ModerationState (pending / approved / rejected / edited-and-resubmitted)
- ClientMsgId (idempotency, Wasla_29)

### Notification
System notifications:
- NotificationId, UserId, NotificationType, Channel (in-app / push / email)
- PayloadRef, ReadAt, DismissedAt
- PreferenceKey (maps to Wasla_16 preferences)
- Sensitive content is never placed in notification payloads (Wasla_16)

### Favorite
Saved profiles.

### Like
Expressed interest between two profiles. Distinct from Favorite:
- Like is an interest signal used by matching and messaging.
- Favorite is a private bookmark for the user's own review.

### Block
Blocked profiles. Blocking is bidirectional: a blocked user cannot see, contact, or be recommended to the blocker.

### Report
User reports.

### DynamicFieldValue
Stores flexible attributes that are not static columns.

### ModerationLog
Audit trail for every Content Moderation Engine decision.

### TrustScoreChange
Log of every Trust Engine score change.

### Subscription
Subscription lifecycle.

### Payment
Payment records.

## Master Data

The canonical list is defined in Wasla_08 (single source of truth). Reference entities:
- Countries, Cities, Nationalities, Religions, Sects, Languages, Professions, Education Levels, Marital Status, Body Types, Skin Tones, Eye Colors, Hair Colors, Hair Types, Clothing Styles, Hobbies, Sports (optional)

Hierarchies (Country → State → City → District, City → Neighborhoods) and dynamic dependencies are modeled per Wasla_08.

## Storage Strategy

### Static Columns
Fixed schema columns (storage concept). Examples:
- Gender
- DateOfBirth
- CountryId
- CityId
- ReligionId
- MaritalStatusId
- Height
- Weight
- ProfessionId
- HasChildren
- IsVerified

### Dynamic Fields
Evolve with the user's journey. Examples:
- Hair color (master-data-backed)
- Hair type (master-data-backed)
- Clothing style (master-data-backed)
- Cooking skills
- Home decoration
- Future optional fields

Note: storage column and classification are separate concepts. Profession and City keep fixed reference columns (ProfessionId, CityId) yet their values evolve with the user, so they classify as **Dynamic**. Master-data-backed fields (hair, clothing, body, skin, eye, etc.) are **Dynamic Fields whose values come from master lists** — the two views do not conflict.

### Separate Tables
- Photos
- Messages
- Notifications
- Reports
- Verification
- Payments

## Data Classification

Every piece of data falls into one of four classes:

- **Static** — rarely changes, set once: Birth Date, Gender, Country.
- **Dynamic** — evolves with the user's journey: Profession, City, Profile Completion.
- **Calculated** — derived by the Formula Engine, never entered: Match Score, Recommendation Score, Compatibility.
- **System** — managed by the platform: Verification Status, Fraud Risk, Moderation Status.

## Ownership

Every entity defines its owner:

- Applicant Photo → Applicant
- Trust Score → System
- Verification Status → System
- RelationshipToApplicant → Account Owner
- Moderation Decision → System / Admin

## Engine Ownership

Each entity identifies which engine owns it:

- Trust Score → Trust Engine
- Match Score → Matching Engine
- Recommendation Rank → Recommendation Engine
- Workflow State → Workflow Engine
- Moderation Status → Content Moderation Engine
- Notification Queue → Notification Engine

This keeps engine boundaries crystal clear.

## Configuration Is Not Business Data

Configuration, rule definitions, feature flags, master data, workflows and formulas are configuration data — not applicant data. They are managed separately and never mixed with the applicant model.

## Lifecycle & Events

Every major entity defines its lifecycle (Created → Updated → Archived → Deleted → Versioned → Audited as applicable) and the events it emits (ApplicantUpdated, PhotoUploaded, VerificationCompleted), which connect naturally to the Event Engine.

## Design Rules

- IDs everywhere.
- Never store localized text in transactional tables.
- Use Codes for business logic.
- All business rules belong to dedicated engines.
- Use ProfileId for social relationships.
- Social relationships (Like, Block, Match, Conversation) are always between two ProfileIds and work in both directions.
- Sensitive data is stored separately from matching data and is protected from rule-driven exposure.

## Data Retention & Deletion

- Users can delete their account and data at any time.
- Deletion removes personal and profile data; the user can always choose to fully erase.
- Audit and moderation logs are kept without personally identifiable linkage beyond the legal retention period.
- Blocking is never undone by data cleanup.
- Policy and retention periods are configurable by administrators, never hardcoded.

## Future Ready

The model must support:
- AI recommendations
- Multiple languages
- Feature flags
- Event-driven architecture
- Admin configuration
- Millions of users

## Cross-References
- Profile fields → [Wasla_05](Wasla_05_Profile_Fields.md)
- Master data & localization → [Wasla_08](Wasla_08_Master_Data_And_Localization.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Roles & Permissions → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
