# Wasla (وصلة) – Product Philosophy

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Vision
Wasla is not a dating app that collects data.
It is an intelligent matchmaking platform that helps people find compatible life partners.

## Core Principles

### 1. Help, don't interrogate
Registration must be extremely simple.
Profile completion happens gradually through encouragement.

### 2. Every piece of data has a purpose
No information is collected without a clear business purpose. Every piece of data must contribute to one or more of:
- Matching
- Search
- Recommendations
- Trust
- Verification
- Privacy
- Security
- Personalization

If a field does not improve the platform in a measurable way, it should not exist.

### 3. Dynamic profile growth
The profile is not a static form. It grows progressively along the user's journey, and questions appear only when they become relevant — driven by the Rule Engine (Wasla_06 / Wasla_11) rather than hardcoded UI logic.

### 4. Global-first, Arab & Muslim optimized
The platform supports everyone while providing deep dynamic support for Muslim and Arab users.

### 5. Privacy by design
Users control visibility.
Hidden fields are never used for ranking or recommendations unless the user has explicitly consented, and any such use is disclosed in the platform privacy policy.
Transparency always wins: if a field influences a decision the user sees, the user can learn why.

### 6. Trust before communication
Verification, profile quality, moderation and trust score are first-class concepts.
Content moderation is a core security layer applied to every text field, not an optional feature.

### 7. Explainable matching
Never show only a percentage.
Always explain WHY two people match.

### 8. Data-driven architecture
Rules, weights, workflows, formulas, feature flags and configuration belong in data/admin panels, not hardcoded. The platform should evolve by changing configuration whenever possible instead of modifying application logic.

### 9. Event-driven platform
Every important action emits an event consumed by independent engines.

### 10. Modular architecture
Independent engines, each with a single responsibility:
- Matching Engine
- Recommendation Engine
- Search Engine
- Event Engine
- Workflow Engine
- Rule Engine
- Notification Engine
- Subscription Engine
- Trust Engine
- Content Moderation Engine

Engines communicate through events and well-defined contracts, not direct dependencies.

### 11. Applicant-centric design
The platform distinguishes the **Account Owner** (the person who registers and manages the account) from the **Applicant / Profile Owner** (the person whose marriage profile is created). An account may represent the owner themselves or a family member / relative. Regardless of who manages the account, all profile information, partner preferences and matching decisions always belong to the applicant. This distinction is fundamental across registration, profile, permissions, messaging and verification.

## Product Rules

- Registration friction must be minimal.
- Encourage, never force profile completion.
- Avoid self-rating questions.
- Prefer factual information.
- Dynamic fields based on previous answers.
- Multilingual from day one.
- Every searchable field should support partner preferences.
- Separate Preferences from Hard Rules.
- Separate Compatibility Score from Profile Quality.
- Separate the Account Owner from the Applicant (Profile Owner).
- Search is secondary; recommendations are primary.
- The platform never restricts a user without explaining why and how to fix it.
- Every feature ships with a defined V1 scope; anything outside the scope is documented as future, not silently promised.

## Long-term Goal
Users should feel:
"The platform is actively helping me find the right partner."

This philosophy is the foundation for every future technical and UX decision.

## Cross-References
- Product Principles → [Wasla_02](Wasla_02_Product_Principles.md)
- Registration → [Wasla_03](Wasla_03_Registration.md)
- Architecture → [Wasla_README.md](Wasla_README.md)
