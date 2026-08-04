# Wasla 06 - Dynamic Fields & Rule Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

This document defines how dynamic fields work inside Wasla and introduces the Rule Engine responsible for controlling visibility, validation and behavior.

## Vision

The application should never contain hardcoded UI conditions whenever they can be represented as configurable business rules.

Instead of:

if (Gender == Male && Religion == Islam)

the system should evaluate configurable rules stored in the database.

---

# Objectives

- Dynamic profile experience
- Reduce unnecessary questions
- Reusable rules
- Admin configurable behavior
- No duplicated business logic

# Rule Safety

The Rule Engine is powerful, so it must be bounded:

- Rules can never make a protected field required, matchable, or visible to others.
- Rules cannot weaken privacy settings chosen by the user.
- Every rule carries an owner, a reason, and a version.
- A rule change is a controlled action, logged and reviewed, not an instant silent switch.
- Sensitive domains (Health) are excluded from rule-driven exposure by definition.

# Gentleness & Hard Rules (Directional)

The default is a preference: values raise or lower the match score but never exclude.

Hard exclusion rules are the exception and are reserved for identity-level facts where ambiguity would waste someone's time:

- Marital status (must match the direction of the search).
- Accept polygamy = NO vs multiple wives → excluded.
- Accept a partner with children = NO vs has children → excluded.
- Relocation / expatriation = NO (optional hard rule, upgradeable by the searcher).
- Smoking = NO (optional hard rule, upgradeable by the searcher).

Everything else stays a preference: religiosity, education, profession, personality, hobbies, home skills, working wife, personal allowance, seriousness, prayer habit, living arrangement.

When a preference differs, the platform never judges and never labels — it gently leaves the topic for the two partners to discuss later.

Hard rules are always directional and always configurable in the Rule Engine, never hardcoded.

# Match Rules for the Desired Partner Group (Wasla_04 §13)

Summary of agreed match behavior:

| Field | Behavior |
|---|---|
| Marital status | Hard, directional |
| Accept polygamy (woman) | NO + polygamous man = excluded |
| Accept partner with children | NO + has children = excluded |
| Children desire | Soft mismatch reason (WANTS vs DOES_NOT_WANT), never automatic exclusion; DOES_NOT_WANT_ACCEPTS_PARTNER never conflicts |
| Relocation / expatriation | Preference; searcher may upgrade NO to hard |
| Smoking | Preference; searcher may upgrade NO to hard |
| Religiosity | Preference only |
| Education | Preference only |
| Profession | Preference only |
| Personality / hobbies | Preference only (max 3 each) |
| Home skills | Preference only |
| Working wife vs housewife | Preference only, never strict |
| Personal allowance | Preference only, no amounts |
| Living arrangement | Preference only |
| Seriousness | Preference only |
| Health (chronic) | Never matched, never ranked |
| Medical barrier | Protected, premium private disclosure |

# Dynamic Fields

A dynamic field is any field that appears only after one or more conditions become true.

Examples

## Divorce Year

Visible When

Marital Status = Divorced

---

## Profile For (Account Relationship)

Profile For = Myself

↓

Hide RelationshipToApplicant

Profile For = A Relative

↓

Show RelationshipToApplicant

↓

Require RelationshipToApplicant

This is one of the core dynamic examples: the account-level answer changes which registration and onboarding fields appear (Wasla_03).

## Number of Current Wives

Visible When

Gender = Male

Religion = Islam

Marital Status = Married

---

## Polygamy — Directional Questions

Man (asks about himself):

Visible When

Gender = Male

Questions:
- Is he polygamous? (not married / one wife / multiple wives)

Woman (asks about the partner she seeks):

Visible When

Seeking a Man (levels b / d)

Questions:
- Does she accept polygamy? (yes / no / no preference)

Effect:
- If she answers "no" (hard rule) and the man has multiple wives → excluded.
- If she accepts or has no preference → the polygamous man may match with an explicit reason.

Married men may search in V1, transparently:
- "Married" is always visible on the card.
- The woman's accept-polygamy preference is applied automatically.
- No hiding, no second accounts.

---

## Marital Housing (asked of the man as provider)

Visible When

Profile is a Man (levels a / c)

Questions:
- Marital home: Rent / Own / Village house / Family apartment / Family house flat / No housing yet
- Who the couple will live with: Alone / With his family / Near family / Far from family

Related (derived, not asked directly):
- Financial stability indicator = derived from profession + housing + supports-parents.

Privacy:
- Housing details and the stability indicator are protected: visible to potential matches only, never on a public page.

---

## Children — Dynamic by Marital Status

Visible When

Marital Status = Married OR Divorced OR Widowed

(Not shown when Single, in V1.)

Questions for the profile owner:
- Has children? (yes / no / prefer not to answer)
- Number
- Age groups
- Do they live with him/her?

Questions for the one searching (directional, mirror):
- Accept a partner with children? (yes / no / no preference)
- Accept living with the partner's children? (yes / no / no preference)

Effect:
- If the searcher answers "no" (hard rule) and the profile has children → excluded.
- Otherwise children contribute to the match score and reasons.

Privacy:
- Has children and count: visible.
- Live-with and age groups: protected (potential matches only).

---

## Accept Living With My Children

Visible When

Has Children = Yes

---

## TELL_LATER — Deferred Answer State

A sensitive field may accept the value TELL_LATER ("will tell you later") instead of a value or "prefer not to answer".

Behavior:
- Matching: neutral — behaves like NO_PREFERENCE (no penalty, no reward) until the user discloses.
- No negative match reason ("did not answer").
- On conversation start (e.g., mutual accept), the platform offers an organized private disclosure prompt for the field.
- After disclosure, the field behaves normally.

Allowed only on sensitive fields (desire for children, medical barrier, chronic conditions, financial status, disability).

NOT allowed on fields that may be a hard rule for the other side (marital status, polygamy status, accept polygamy, accept partner's children) — ambiguity there would mean a delayed exclusion.

Limit: maximum 3 TELL_LATER fields per profile (configurable).

Trust: TELL_LATER fields are watched by the Trust Engine (slightly elevated review).

---

# Rule Types

## Visibility Rules

Controls whether a field is displayed.

## Full Dynamic Behavior Set

A dynamic field may be controlled by more than visibility:

- Show / Hide
- Required / Optional
- Read Only / Editable
- Enabled / Disabled
- Default Value
- Auto-filled (from master data or prior answers)
- Auto-calculated (by the Formula Engine, e.g., derived indicators)

---

## Validation Rules

Controls whether a value is valid.

Examples

Age >= 18

Age <= 78

Weight between 45 and 145

---

## Required Rules

A field may become mandatory only under certain conditions.

Example

Divorce Year becomes required only if Marital Status = Divorced.

---

## Match Rules

Determines whether a field participates in compatibility calculations.

---

## Search Rules

Determines whether a field is searchable.

---

# Rule Engine

Each rule contains

- Rule ID
- Rule Name
- Target Field
- Rule Type
- Conditions
- Action
- Priority
- Enabled

---

# Rule Sources

Rules may depend on:

- Applicant data
- Account type (self / relative)
- Country
- Religion
- Gender
- Subscription
- Verification status
- Trust level
- Feature Flag
- Admin configuration
- Workflow state

Everything is available as a rule input — rules are never limited to the current group.

---

# Rule Priority

Multiple rules may affect the same field. Priority decides which wins:

- System Rule
- ↓
- Legal Rule
- ↓
- Business Rule
- ↓
- Admin Rule
- ↓
- User Preference

Higher priority wins.

---

# Dynamic Lists

Some dropdown values change based on earlier answers:

- Cities ← based on Country
- Neighborhoods ← based on City
- Sects ← based on Religion
- Degrees ← based on Education Level

List dependencies are consumed by the Rule Engine, not hardcoded in UI.

---

# Cross-Group Rules

Rules are not limited to the current group. A single value may cascade across groups:

- Religion
- ↓
- Marriage group
- ↓
- Children group
- ↓
- Partner preferences
- ↓
- Matching rules

---

# Feature Flags

Dynamic rules support Feature Flags:

- Feature Flag = OFF (e.g., video profiles)
- ↓
- Hide the entire section
- No UI changes required

A disabled feature's rules are ignored entirely.

# Supported Operators

Equals

Not Equals

Greater Than

Less Than

Between

Contains

In List

Exists

Empty

Not Empty

---

# Actions

Show Field

Hide Field

Require Field

Disable Field

Enable Field

Assign Default Value

Calculate Value

---

# Nested Rules

Rules may contain AND / OR groups.

Example

(Gender = Male)

AND

(Religion = Islam)

AND

(Marital Status = Married)

---

# Benefits

- Faster feature development
- Less duplicated code
- Easier maintenance
- Better localization
- Future AI support

---

# Golden Rule

Business rules belong inside the Rule Engine, not inside UI code or API controllers.

Second rule: the Rule Engine never overrides a user's privacy choice and never exposes a protected field.

## Cross-References
- Field metadata → [Wasla_05](Wasla_05_Profile_Fields.md)
- Rule Engine (detailed) → [Wasla_11](Wasla_11_Rule_Engine.md)
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
