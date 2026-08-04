# Wasla 02 - Product Principles

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
This document defines the non-negotiable product principles that guide every feature, UI decision, API, and business rule.

## Principles

### 1. Registration First, Completion Later
- Registration must be as short as the method allows:
  - Social login (Google/Facebook): under one minute.
  - Phone (OTP) or Email: up to three minutes, including verification.
- Registration may be performed for myself or for a relative (guardian flow, levels c/d — see Wasla_03).
- Supported methods:
  - Google
  - Facebook
  - Phone Number
  - Email
- The profile is completed progressively.
- Registration never requires a photo, verification, or any profile detail beyond the essential fields.

### 2. Encourage, Never Force
Profile completion should be driven by positive reinforcement:
- Profile completion percentage
- Missing section reminders
- Better matching messages
- Never overwhelm users with long forms.

Completion follows a "flight risk" ordering:
- The profile asks the easy, non-threatening data first (identity, location, marital status, basic physical).
- Anything that could make a member flee (health, finances, sensitive) comes last and is always optional.
- On each login the member is encouraged to complete the profile, with the concrete benefit of each missing field explained.
- A fully completed profile is not necessarily a high-quality profile (see Wasla_05 §9).

### 3. One Screen = One Goal
Each screen collects one logical set of information and minimizes cognitive load.

### 4. Dynamic Experience
Questions appear only when relevant, driven by the Rule Engine rather than hardcoded UI logic.
Examples:
- Divorce year appears only for divorced users.
- Accept my children? appears only if the user has children.
- Polygamy fields appear only for Muslim men when applicable.
- "Profile for a relative" reveals the relationship question only when chosen.

### 5. Facts Over Opinions
Prefer measurable facts over self-descriptions.
Examples:
- Smoking
- Height
- Profession
Avoid subjective questions such as "Are you romantic?"

### 5a. Gentleness — Preference Before Hard Rule
Everything should feel gentle. Hard exclusion rules are the exception, not the default:
- Most preferences (religiosity, education, profession, home skills, working wife, seriousness, hobbies) raise or lower the match score only — they never exclude.
- Hard rules are reserved for identity-level facts where ambiguity would waste someone's time (marital status, polygamy acceptance, accepting a partner's children). Two further rules — smoking and relocation — are optional hard rules that a searcher may upgrade to strict (Wasla_06).
- When two preferences differ, the platform never judges — it leaves the topic to be discussed gently between the two partners later.
- Directional mismatches are softened with phrasing like "you two can talk about this" rather than a rejection.
- No negative scoring, no shame, no labels.

### 6. Privacy by Default
Users control profile visibility. Hidden fields are never used in ranking without explicit consent, and any such use is disclosed in the platform privacy policy. Transparency always wins over hidden influence. Privacy rules apply independently from matching logic — a hidden field may still participate in matching when policy allows, without exposing the value itself.

### 7. Trust Before Contact
Verification, moderation and account quality are core product features.
Every text field passes through the Content Moderation Engine before it is accepted.

### 8. Explain Every Match
Always explain why two members match.
Examples:
- Same city
- Same religion
- 3 common hobbies (max selectable is 3, Wasla_05)
- Both prefer relocation

### 9. Search Is Secondary
The recommendation engine is the primary discovery mechanism.
Search remains available for advanced users.

### 10. Configuration Over Code
Avoid hardcoded values.
Everything possible should be configurable:
- Matching weights
- Limits
- Feature flags
- Business rules
- Workflow transitions
- Formula definitions
- Validation rules
- Dynamic field visibility

### 11. Modular Architecture
Independent engines, each with a single responsibility, independently deployable where practical, communicating through well-defined events and contracts rather than direct dependencies.

### 12. Defined Scope
Every feature carries an explicit V1 scope. Features outside V1 are documented as future and never half-promised to users.

## UX Rules
- Minimize typing.
- Prefer selections over free text.
- Support mobile-first interactions.
- Use visual controls (chips, sliders, palettes) when appropriate.
- Every optional field should clearly improve matching quality.
- Every label and question must clearly indicate whether it refers to the Applicant or the Account Owner whenever the two may differ.

## Success Metric
A successful user feels the platform is actively helping them find the right life partner rather than simply browsing profiles.

## Cross-References
- Philosophy → [Wasla_01](Wasla_01_Philosophy.md)
- Registration → [Wasla_03](Wasla_03_Registration.md)
- Content Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
