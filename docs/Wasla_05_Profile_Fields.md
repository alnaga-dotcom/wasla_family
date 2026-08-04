# Wasla 05 - Profile Fields Specification

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
This document defines the standard specification for every profile field in Wasla.

## Field Definition Framework

Every field is described by ten metadata sections, not just a flat list of properties. This framework is the master definition used across registration, profile groups, matching, search, trust and the Admin Panel.

### 1. Field Definition
- Field ID
- Internal Code
- Display Name
- Description
- Profile Group
- Data Type
- Default Value
- Allowed Values
- Owner (Applicant / System / Admin)
- Editable By
- Version

### 2. Visibility & Privacy
Who can see the field, under which conditions:
- Only Me
- Platform Only
- Potential Matches
- Mutual Matches
- After Approval
- Hidden
- Configurable

Visibility is independent from the field itself and is controlled by rules.

### 3. Requirement Rules
Not simply "Required / Optional" — define when a field becomes required:
- Optional
- Required During Registration
- Required Before Publishing
- Required Before Matching
- Required By Rule

### 4. Trust & Verification
Every field declares its trust level:
- Self Declared
- Document Verified
- Admin Verified
- System Verified
- Third-Party Verified
- Not Verifiable

Integrates with the Trust Engine.

### 5. Lifecycle
- Created
- Updated
- Archived
- Audit History
- Last Modified
- Version

Some fields require history; others do not.

### 6. Data Source
Where the value comes from:
- Master Data
- Free Text
- Calculated
- Selected from Configuration
- External Service
- Derived

### 7. Dynamic Behavior
All runtime behavior, not only visibility:
- Visible When
- Hidden When
- Required When
- Read Only When
- Enabled When
- Default Value Rules

Direct consumer of the Rule Engine.

### 8. Evolution & Compatibility
How fields evolve:
- Deprecated?
- Renamed?
- Split?
- Merged?
- Backward compatibility rules

### 9. Completion & Quality
Two separate concepts:
- Completion: How much information is provided.
- Quality: How useful and trustworthy the information is.

A fully completed profile is not necessarily a high-quality profile.

### 9a. Completion Percentage
The system measures profile completion as a percentage. It is derived from completed fields weighted by tier (see 9b).

The percentage is shown to the user as a positive signal, never as a punishment. It is personal — never displayed to other members.

Verification boosts the percentage (incentive, not requirement):
- Phone verified: +5%
- Selfie verified: +10%
- ID verified: +5%

The percentage is never shown to others. 100% means "complete", not "high quality" (see §9).

### 9b. Completion Tiers — Question Ordering by "Flight Risk"
Questions are ordered by how likely they are to make a member leave. The principle: ask the easy, non-threatening data first, and keep anything that could make the member flee for later.

Tier 1 — Entry (low flight risk): identity, gender, age, location, marital status, basic physical (height, weight). Enough to start matching quickly.
Tier 2 — Confidence (medium): education, profession, housing, children, values, lifestyle.
Tier 3 — Sensitive (higher flight risk): health, chronic conditions, financial status, medical barrier, anything answered with TELL_LATER.

Rules:
- Tier 1 is effectively required to participate; the profile works but matching quality is reduced.
- Tier 3 is always optional and never blocks anything.
- Completing a tier rewards the percentage; skipping a tier never punishes.

### 9c. Nudging on Each Login
Every time the member logs in, the system encourages completing the profile:
- Shows the current percentage and what is missing.
- Explains the concrete benefit of each missing field ("Adding your profession improves your matches and increases serious interest").
- One screen, one goal: one nudge per session unless the member chooses to continue.
- Never forces, never blocks usage.

### 9d. Nudge Message Rules
- One nudge per session, gentle, in-app (never a push).
- Order follows the tiers: photo → selfie → profession → sensitive.
- Sensitive values (health, personal allowance, medical barrier) are never mentioned in nudges.
- Phrasing is positive and benefit-based, never shaming.
- Verification nudges frame verification as an achievement, not a duty.

### 9e. Completion Steps (Visible Checklist)
A simple progress checklist in the member's own profile page — not gamification:
- Each step states a clear action and its percentage contribution (e.g., "Add your photo +5%", "Verify with a selfie +10%").
- Its only purpose is to show what raises the percentage next.
- No badges, no rewards, no medals.
- The checklist is personal — never shown to other members.
- Steps follow the tier order (photo → selfie → profession → preferences → sensitive).
- Completed steps are marked; remaining steps stay visible as a gentle guide.

### 10. Domain Classification
Every field belongs to a domain:
- Identity
- Contact
- Personal
- Physical
- Religious
- Education
- Career
- Financial
- Family
- Health
- Lifestyle
- Marriage
- Preferences
- Verification
- System

## Answer State: "Will Tell You Later" (TELL_LATER)

A third answer state for sensitive fields, better than "prefer not to answer".

### Definition
When a user selects TELL_LATER, they signal that an answer exists but will be shared privately once a real conversation starts.

### Behavior
- Matching: neutral — behaves like NO_PREFERENCE (no penalty, no reward) until the user discloses.
- No negative match reason ("did not answer").
- On conversation start (e.g., mutual accept), the platform offers an organized private disclosure prompt for the field.
- After disclosure, the field behaves normally (matchable, visible to potential matches).

### Where TELL_LATER is Available
Only sensitive fields:
- Desire to have children
- Medical barrier to childbearing
- Chronic conditions
- Financial status / income (if asked)
- Disability
- (Any future sensitive field flagged as TELL_LATER-capable)

### Where TELL_LATER is NOT Allowed
Fields that may be a hard rule for the other side, where ambiguity would mean a delayed exclusion:
- Marital status
- Number of wives / polygamy status
- "Accept polygamy"
- Acceptance of partner's children

### Limits
- Maximum of 3 TELL_LATER fields per profile (configurable), to prevent a profile of deferred answers.
- TELL_LATER fields are watched by the Trust Engine (slightly elevated review), consistent with earned trust.

## Field Metadata Template

Every field must define:

- Field ID
- Internal Code
- Display Name
- Description
- Business Purpose (matching / search / recommendation / verification / trust / profile display / analytics / administration / workflow / compliance — if none exists, the field must not exist)
- Profile Group
- Data Type
- UI Control
- Required (Yes/No)
- V1 / Future
- Static Column / Dynamic Field
- Data Owner (Applicant / Account Owner / System / Admin)
- Editable By
- Searchable
- Matchable
- Partner Preference Supported
- Hard Rule Supported
- Visibility Rules
- Validation Rules
- Privacy Level
- Content Moderation (Required / Optional / Not Applicable)
- Verification Level (Self Declared / Document Verified / System Verified / Admin Verified / Not Verifiable)
- Configuration Source (Master Data / System Configuration / Feature Flag / Formula Engine / Rule Engine)
- AI Usable (yes / no — and for which purpose: recommendation, fraud detection, moderation, insights)
- Localizable
- Default Value
- Sort Order
- Admin Editable

---

## Example: Height

Field Code: HEIGHT

Purpose:
Used for search, matching and profile display.

Storage:
Static column.

Data Type:
Integer (cm)

UI:
Slider + Numeric input

Validation:
145–205 cm (reject values outside the range)

Required:
Optional in registration.
Strongly encouraged later.

Search:
Yes

Matching:
Yes

Partner Preference:
Supported (range)

Hard Rule:
Supported

Privacy:
Visible by default because it is a core matching attribute.

---

## Example: Weight

Field Code: WEIGHT

Storage:
Static column

Data Type:
Integer (kg) — internal only

UI:
Slider

Validation:
45–145 kg (reject values outside the range)

Display:
The weight number is never shown. The profile displays body type only, derived from the value:
- SLIM (نحيف)
- ATHLETIC (رياضي)
- AVERAGE (معتدل)
- FULLER (ممتلئ)

Matching:
Supported

Preference:
Range (internal) / body type

Privacy:
User configurable. Number is private; body type is what others see.

---

## Example: Marital Status

Field Code: MARITAL_STATUS

Purpose:
Core matching attribute and master switch for dynamic fields (wives count, children, housing).

Storage:
Static column.

Data Type:
Master Data enum.

Allowed Values:
SINGLE / MARRIED / DIVORCED / WIDOWED

UI:
Selection chips.

Required:
Yes (a profile cannot match without it).

Search:
Yes

Matching:
Yes (filter + preference)

Partner Preference:
Supported

Hard Rule:
Supported

Privacy:
Visible by default — it is a core decision factor.

Dynamic Behavior:
- MARRIED + Male + Islam → wives count
- MARRIED / DIVORCED / WIDOWED → children group
- Never ENGAGED (removed from V1)

---

## Example: Polygamy (Directional)

Field Code: POLYGAMY_STATUS (man) / ACCEPT_POLYGAMY (woman)

Purpose:
Two separate directional questions, never one.

Storage:
Static column.

Data Type:
Master Data enum.

Man values:
NOT_MARRIED / ONE_WIFE / MULTIPLE_WIVES

Woman values:
YES / NO / NO_PREFERENCE

Matching:
- Woman NO + man MULTIPLE_WIVES → excluded (hard rule).
- Woman YES / NO_PREFERENCE → man may match with explicit reason.

Privacy:
- Man's status: protected, shown clearly to potential matches.
- Woman's answer: protected, never shown to men.

---

## Example: Marital Housing

Field Code: MARITAL_HOUSING

Purpose:
Asked of the man (provider); informs the woman's family about the marital home.

Storage:
Static column.

Data Type:
Master Data enum.

Allowed Values:
RENT_APARTMENT / OWNED_APARTMENT / VILLAGE_HOUSE / FAMILY_APARTMENT / FAMILY_HOUSE_FLAT / NO_HOUSING_YET

Matching:
Yes (preference)

Partner Preference:
Supported

Hard Rule:
Preference only (per Wasla_06). Living arrangement never excludes automatically; the searcher's strong preference is discussed between the two partners later.

Privacy:
Protected — visible to potential matches only, never on a public page.

Related:
- LIVING_ARRANGEMENT: alone / with his family / near family / far from family
- SUPPORTS_PARENTS: full support / partial / no
- Stability indicator: derived from profession + housing + supports-parents (never asked directly, never shown raw)

---

## Example: Children (Dynamic)

Field Code: HAS_CHILDREN, CHILDREN_COUNT, CHILDREN_AGES, CHILDREN_LIVE_WITH

Purpose:
Determines the children situation for divorced, widowed, or married profiles.

Storage:
Static columns + dynamic.

Dynamic Behavior:
Visible when MARITAL_STATUS in (MARRIED, DIVORCED, WIDOWED).
Not shown when SINGLE (V1).

Questions (profile owner):
- Has children? / Number / Age groups / Live with them?

Questions (searcher, mirror):
- ACCEPT_PARTNER_WITH_CHILDREN: yes / no / no preference
- ACCEPT_LIVE_WITH_CHILDREN: yes / no / no preference

Matching:
- Searcher NO + profile HAS_CHILDREN → excluded (hard rule).
- Otherwise contributes to score and reasons.

Privacy:
- Has children + count: visible.
- Live-with + age groups: protected (potential matches only).

---

## Example: Hair Color

Storage:
Dynamic

UI:
Visual color palette

Search:
Optional

Matching:
Yes

Localization:
Required

---

## Example: Glasses (Display Only)

Field Code: GLASSES

Storage:
Dynamic

UI:
Chips: GLASSES (نظارات) / CONTACT_LENSES (عدسات لاصقة) / NONE (بدون) / TELL_LATER (يخبرك لاحقًا)

Search:
No

Matching:
No — display only, never matched or ranked.

Purpose:
Helps a partner recognize the person in real life.

Privacy:
Visible.

---

## Example: Hobbies

Storage:
Dynamic

UI:
Multi-select chips

Matching:
Common interests calculator

Search:
Yes

Partner Preference:
Supported

---

## Example: Health Condition (Sensitive Field)

Field Code: HEALTH_DISCLOSURES

Purpose:
Optional, factual, user-initiated disclosure. Never collected proactively.

Storage:
Dynamic

UI:
Optional structured disclosures with "Prefer not to answer".

Matching:
No. Health data never participates in matching or ranking.

Search:
No

Privacy:
Only the user can share it; shared only if the user explicitly chooses to.

Trust:
Self declared, Not Verifiable.

Evolution:
Protected field — cannot be made required or matchable by any future rule.

---

## Example: Home Skills (Female Owner)

Field Code: HOME_SKILLS

Purpose:
Culturally relevant, optional, multi-select chips. Asked of the female profile (levels b / d) about herself.

Options:
COOKING / HOME_ORGANIZATION / CHILD_CARE / HOSPITALITY / BUDGET_MANAGEMENT / NONE / TELL_LATER

Partner Preference (man, levels a / c):
Same list. Preference only — raises or lowers the score, never excludes.

Matching:
Preference only (weighted, non-strict).

Search:
Yes

Privacy:
Visible to potential matches only, never on a public page.

Trust:
Self declared.

---

## Example: Religiosity (Sensitive Field)

Field Code: RELIGIOSITY

Purpose:
Optional, self-described level. Never an external judgment.

Storage:
Dynamic

UI:
PRACTICING / VERY_RELIGIOUS / MODERATE / MINIMAL / TELL_LATER

Partner Preference (searcher):
MATCH_OR_HIGHER / ANY / specific level.

Matching:
Preference only (non-strict). Real religious fit is discovered through conversation, not a list.

Search:
Yes

Privacy:
Visible to potential matches only, never on a public page.

Trust:
Self declared.

Evolution:
Protected field — cannot be made required or a hard rule by a future rule.

---

## Example: Partner's Children from a Previous Marriage

Field Code: PARTNER_CHILDREN_ACCEPTANCE (searcher) / CHILDREN_LIVE_WITH (owner)

Owner (shown when children exist):
Do the children live with you? YES / NO / SOME / TELL_LATER

Searcher:
NO_CHILDREN_PREFERRED / ACCEPT / NO_PREFERENCE

Matching:
Preference, non-strict — except the reserved hard rule "accept a partner with children" (Wasla_06): a clear NO from the searcher excludes a profile with children. Beyond that, children themselves are not an exclusion and living arrangements are discussed later.

Note:
Acceptance of a partner's children is one of the few reserved hard-rule fields (see Wasla_06). The hard-rule form is "accept a partner with children? yes / no / no preference".

Privacy:
Ownership and count of children: visible. Live-with and age groups: protected (potential matches only).

---

## Example: Living Arrangement (Housing After Marriage)

Field Code: LIVING_ARRANGEMENT (owner) / ACCEPT_LIVING_ARRANGEMENT (searcher)

Owner:
COUPLE_ALONE / WITH_PARENTS / NEAR_FAMILY / FAR_FROM_FAMILY / TELL_LATER

Searcher:
COUPLE_ALONE_ONLY / ACCEPT_WITH_FAMILY / NO_PREFERENCE

Matching:
Preference only (non-strict), consistent with the Gentleness principle. Sensitive cultural topic left to the two partners to discuss.

Privacy:
Protected — visible to potential matches only.

---

## Example: Money Habits (Daily Management)

Field Code: MONEY_HABIT (owner) / MONEY_PREFERENCE (searcher)

Owner:
PLAN_SAVE / SPEND_AS_NEEDED / COST_SHARING / NOT_ASKED

Searcher:
SAVER / SPENDER / ANY

Matching:
Preference only.

Privacy:
Protected — visible to potential matches only.

Rule:
Explicit salary / income questions are forbidden. The financial stability indicator is derived (profession + housing + supports-parents), never asked directly.

---

## Example: Prayer Habit (Optional, Practical)

Field Code: PRAYER_HABIT (owner) / PRAYER_PRIORITY (searcher)

Owner (optional):
PRAYER_ON_TIME / SOMETIMES_DELAY / IRREGULAR / NOT_ASKED

Searcher:
IMPORTANT / NOT_IMPORTANT / ANY

Matching:
Preference only (non-strict).

Privacy:
Visible to potential matches only.

---

## Example: Personal Allowance (Sensitive — Financial)

Field Code: PERSONAL_ALLOWANCE

Terminology:
Called "personal allowance" (مصروف شخصي), never "maintenance" (نفقة) — the latter carries heavy legal implications in the region.

Owner (female profile):
EXPECTS / NOT_REQUIRED / DISCUSS_LATER / NOT_ASKED

Searcher (male profile):
WILL_COMMIT / CONDITIONAL / DISCUSS_LATER / NOT_ASKED

Matching:
Preference only (non-strict). A difference is never an exclusion — the topic is left to the two partners.

Rules:
- Never asks for amounts. Money figures are forbidden (consistent with "no explicit income").
- DISCUSS_LATER is the gentle escape; NOT_ASKED remains available.
- Visible to potential matches only, never on a public page.

Privacy:
Protected — potential matches only.

---

## Example: Photos

Purpose:
Photos are never a registration requirement. Registration stays short (principles 01/02).

Baseline:
A main photo improves matching quality but is never mandatory.

Ephemeral photos ("appear and disappear"):
- Photos sent during conversation that cannot be saved.
- View-once or time-limited: they appear and then disappear.
- Screenshot is blocked; download is disabled.
- A subtle watermark may be applied.

Protection:
- No saving, no screenshots, no downloads.
- Real photo check + duplicate/stored-image detection through the Content Moderation Engine.
- Sensitive photos are visible to potential matches only, never to the public.

Per-photo visibility (member's choice):
- Every photo has its own visibility level, chosen by the owner:
  1. Potential matches only (default, most private) — profiles that pass both directions' hard filters.
  2. All verified members inside the platform.
  3. All registered members inside the platform.
- "Public" always means public to members within Wasla — never the open web.
- The open internet is never an option: no external visibility, no hotlinking, no search-engine indexing, no sharing outside the platform.
- The broadest level never bypasses protection: download/save disabled, screenshot-protected where feasible, duplicate-image reuse detection always active.
- Additional photos still unlock only after mutual like, regardless of the chosen visibility of the main photo.

---

## Example: Working Wife vs Housewife (Directional, Gentle)

Field Code: WORK_INTENTION (owner) / ACCEPT_WORKING_WIFE (searcher)

Owner (female profile):
PLANS_TO_WORK / HOUSEWIFE / DECIDES_LATER / TELL_LATER

Searcher (male profile):
ACCEPT_WORKING / PREFER_HOUSEWIFE / ANY

Rule:
Preference only, never strict. A mismatch (PREFER_HOUSEWIFE vs PLANS_TO_WORK) is not an exclusion — the platform gently leaves the topic for the two partners to discuss later.

Matching:
Preference only.

Search:
Yes

Privacy:
Visible to potential matches only.

---

## Example: Smoking (Directional)

Field Code: SMOKING (owner) / ACCEPT_SMOKER (searcher)

Owner:
NONE / CIGARETTES / HOOKAH / OCCASIONAL / TELL_LATER

Note:
Hookah and cigarettes are separate values — a searcher may accept one but not the other.

Searcher:
YES / NO (optional hard rule) / NO_PREFERENCE

Matching:
Preference by default. The searcher may optionally upgrade "no" to a hard rule.

Search:
Yes

Privacy:
Visible.

---

## Example: Relocation (Directional)

Field Code: RELOCATION (owner) / ACCEPT_RELOCATION (searcher)

Owner:
WILLING_TO_MOVE / STAYS_IN_CITY / UNSURE

Searcher (outside the city):
YES / NO (hard rule option) / NO_PREFERENCE

Searcher (expatriation — abroad):
YES / NO (hard rule option) / NO_PREFERENCE

Note:
Outside-the-city and expatriation (abroad) are separated — different cultural realities.

Matching:
Preference by default; "no" may be upgraded to a hard rule by the searcher.

Privacy:
Visible.

---

## Example: Education (Directional)

Field Code: EDUCATION_LEVEL (owner) / MIN_EDUCATION (searcher)

Owner:
LESS_THAN_HIGH_SCHOOL / HIGH_SCHOOL / DIPLOMA / BACHELOR / MASTER / PHD / OTHER

Searcher:
ANY / HIGH_SCHOOL / DIPLOMA / BACHELOR / MASTER / PHD

Matching:
Preference only, never strict — education is not a measure of faith or character.

Search:
Yes

---

## Example: Profession (Directional)

Field Code: PROFESSION_CATEGORY (owner) / PREFERRED_PROFESSION (searcher)

Owner (category + free-text title):
MEDICAL / ENGINEERING / TEACHING / IT / BUSINESS / TRADE / ARTISAN / GOVERNMENT / HOUSEHOLD / STUDENT / OTHER

Note:
No "unemployed / retired" options — left to direct conversation (sensitive).

Searcher:
ANY / specific category

Matching:
Preference only, never strict. Contributes to the derived financial stability indicator.

Search:
Yes

---

## Example: Personality (Chips, Max 3)

Field Code: PERSONALITY

Owner (max 3):
CALM / SOCIABLE / HOME_PERSON / OUTGOING / SERIOUS / FUNNY / RESERVED / GENEROUS / DECISIVE

Searcher (max 3, same list):
Preference only — raises the score, never strict.

Matching:
Preference only.

Privacy:
Visible.

---

## Example: Hobbies (Multi-Select)

Field Code: HOBBIES

Owner (max 3):
READING / SPORTS / COOKING / TRAVEL / TECH / FARMING / ARTS / RELIGIOUS_ACTIVITY / PHOTOGRAPHY / NONE

Searcher:
Same list — preference only.

Note:
Hobbies are always visible to potential matches — they are conversation starters, never hidden on mismatch.

Matching:
Preference only.

---

## Example: Seriousness & Timing (Directional)

Field Code: INTENTION (owner) / INTENTION_REQUIRED (searcher)

Owner:
IMMEDIATE (ready within months) / SOON (within a year) / EXPLORING / NOT_RUSHING

Searcher:
MATCH_OR_MORE_READY / ANY

Matching:
Preference only — intentions change quickly.

Privacy:
Visible to potential matches only.

---

## Example: Desire to Have Children

Field Code: CHILDREN_DESIRE

Owner:
WANTS_CHILDREN / DOES_NOT_WANT / NO_PREFERENCE / DOES_NOT_WANT_ACCEPTS_PARTNER (لا يرغب بنفسه لكنه يتقبل رغبة شريكه)

Matching:
Matchable, visible. WANTS vs DOES_NOT_WANT = soft mismatch reason, not an automatic hard exclusion. DOES_NOT_WANT_ACCEPTS_PARTNER never conflicts with WANTS — it explicitly accepts the partner's desire.

Note:
The medical barrier to childbearing is separate, protected, never in matching, and never in the public profile. Its organized disclosure is a premium feature — the member chooses to reveal it privately when ready, only to matched partners.

Privacy:
Visible.

---

## Dynamic Visibility

Fields may appear based on rules.

Examples:
- Divorce Year -> Divorced
- Number of Wives -> Muslim + Male + Married
- Accept My Children -> HasChildren = True

These rules belong to the Rule Engine.

---

## Golden Rules

1. Every searchable field should be matchable.
2. Every matchable field should support partner preferences when applicable.
3. Avoid free text whenever structured data is possible.
4. Use visual controls to improve UX.
5. Every field must have a business purpose.
6. Every field follows the ten-section Field Definition Framework.
7. Business rules (visibility, required, validation) belong in the Rule Engine.
8. Sensitive fields (e.g., health) never participate in matching or ranking.
9. No field can be made required, matchable, or visible to others by a future rule if it was protected at creation.
10. Every field has a single source of truth.
11. Every field defines its owner (Applicant / Account Owner / System / Admin).
12. Every text field declares whether it requires content moderation.
13. Avoid duplicate information across fields.
14. Every field that can participate in multiple engines declares its participation in search, matching, recommendations, analytics and AI independently.

## Cross-References
- Profile groups → [Wasla_04](Wasla_04_Profile_Groups.md)
- Dynamic behavior → [Wasla_06](Wasla_06_Dynamic_Fields_And_Rule_Engine.md)
- Storage → [Wasla_07](Wasla_07_Data_Model.md)
- Master data → [Wasla_08](Wasla_08_Master_Data_And_Localization.md)
