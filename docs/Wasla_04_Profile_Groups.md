# Wasla 04 - Profile Groups

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
Define the logical structure of the user profile.

## Design Principles
- Group related fields together.
- One objective per section.
- Progressive completion.
- Dynamic visibility based on previous answers.
- Every group contributes to matching, trust, or search.

## Profile Groups

0. Account Relationship (system group, not part of the applicant profile)
- Profile Created For: Myself / A Relative
- Relationship To Applicant: Father / Mother / Brother / Sister / Son / Daughter / Guardian / Other
Notes:
- Belongs to the Account → Applicant relationship, not to the applicant.
- Stored once at registration (Wasla_03), never matched, never searchable.
- Every field in groups 1–17 belongs to the Applicant — never the Account Owner — regardless of who manages the account.

1. Basic Information
- Name (display)
- Gender
- Date of Birth
- Age

2. Residence & Nationality
- Country
- City
- Nationality
- Willing to relocate
- Preferred marital home (dynamic, answered by the man as provider)
  - Rent / Own / Village house / Family apartment / Family house flat / No housing yet
  - Who the couple will live with (alone / with his family / near family / far from family)
  - Financial stability indicator (derived from profession + housing + supporting parents)

3. Physical Appearance
- Height
- Weight (number private; profile shows body type: slim / athletic / average / fuller)
- Skin tone
- Eye color
- Hair color
- Hair type
- Body type
- Clothing style
- Glasses (display only: glasses / contact lenses / none / tell you later — never matched)
Notes:
- Use sliders, visual palettes and image chips where appropriate.
- Include "Prefer not to answer" where reasonable.

4. Education & Culture
- Education level
- Languages

5. Work & Financial Status
- Profession (category + free text title)
- Employment status (optional)
- Financial stability indicator (derived from profession + housing + supporting parents) — never asked directly, never shown raw.
- Personal allowance (مصروف شخصي) — directional, preference only, no amounts, protected.
- Income range (future/optional) — explicit income questions remain forbidden in V1.

6. Current Marital Status
- Single
- Married
- Divorced
- Widowed
Dynamic (per Rule Engine):
- Number of current wives (Muslim male only).
- Polygamy questions (directional):
  - Man: Is he polygamous? (not married / one wife / multiple wives)
  - Woman (b/d): Does she accept polygamy? (yes / no / no preference)
- Married men may search for an additional wife in V1, transparently:
  - "Married" status is always visible on their card.
  - The woman's "accept polygamy?" preference is applied automatically (NO = excluded).
  - No hiding, no second accounts.

7. Children (dynamic — shown when Divorced, Widowed, or Married)
- Shown for: Married (may have children from a previous marriage), Divorced, Widowed.
- Not shown for: Single (V1).
- Has children
- Number
- Age groups
- Live with him/her?
- Accept partner with children? (asked of the one searching)
- Accept living with the partner's children? (asked of the one searching)
- "Accept living with my children?" (dynamic, asked of the partner)

8. Health
- Optional health disclosures.
- Prefer factual data only.
- Never requested proactively; only shown if the user chooses to add health information.
- No health field may affect matching or ranking.

9. Personality & Lifestyle
- Smoking (none / cigarettes / hookah / occasional) — hookah and cigarettes are separate values.
- Alcohol
- Exercise
- Sleep schedule (future)
- Personality chips (max 3): calm / sociable / home-person / outgoing / serious / funny / reserved / generous / decisive.
- Daily routine (office / flexible / shift / weekends / travel-for-work / student)
- Money habit (saver / spender / any) — protected.
- Home skills (female owner, optional): cooking / home organization / child care / hospitality / budget management — visible to potential matches only.
- Working wife vs housewife intention (female owner): PLANS_TO_WORK / HOUSEWIFE / DECIDES_LATER / TELL_LATER.
- Response speed (fast / moderate / slow / not asked).

10. Religious Commitment
- Religion
- Sect (dynamic)
- Practice level (self-described): PRACTICING / VERY_RELIGIOUS / MODERATE / MINIMAL / TELL_LATER — preference only in matching, visible to potential matches only.
- Prayer habit (optional): PRAYER_ON_TIME / SOMETIMES_DELAY / IRREGULAR / NOT_ASKED — never matched.

11. Interests & Hobbies
- Multi-select interests.
- Used heavily by matching.

12. About Me
- Free text biography.
- Written from the applicant's perspective (even when a relative manages the account).
- Processed by the Content Moderation Engine before saving; strong profanity/contact-information filtering.

13. Preferred Partner
Reuse profile fields as directional preferences. Every preference supports "No Preference" and TELL_LATER where allowed.
These preferences always belong to the Applicant, regardless of who manages the account.

Agreed V1 preferences (all gentle — non-strict unless marked HARD):
- Social:
  - Accept polygamy? (woman b/d) — NO = HARD exclusion vs polygamous man.
  - Accept partner with children? (searcher) — NO = HARD exclusion.
  - Accept living with the partner's children? (searcher)
  - Marital housing expectations (rent / own / family / no housing yet).
  - Living arrangement: couple alone / with family / near family / far from family.
- Physical:
  - Height range (sliders)
  - Weight range (sliders)
  - Eye color / skin tone / hair style — preference only, non-strict.
- Health:
  - Child desire: WANTS_CHILDREN / DOES_NOT_WANT / NO_PREFERENCE — matchable, visible. WANTS vs DOES_NOT_WANT mismatch = no match reason (soft, not automatic exclusion).
  - Chronic conditions: never matched, never ranked.
  - Medical barrier: protected, never in matching, manual disclosure only.
- Lifestyle:
  - Smoking (cigarettes / hookah / occasional / none) — hookah and cigarettes separated.
  - Relocation: outside the city, and expatriation (abroad) separated.
  - Daily routine (office / flexible / shift / weekends / travel-for-work / student).
  - Response speed (fast / moderate / slow).
  - Money habit (saver / spender / any).
- Education:
  - Minimum acceptable level — preference only, non-strict.
- Career:
  - Preferred profession category — preference only, non-strict.
- Religious:
  - Religiosity level (self-described): MATCH_OR_HIGHER / ANY — preference only.
  - Prayer habit priority — preference only.
- Values:
  - Personality chips (max 3): calm / sociable / home-person / outgoing / serious / funny / reserved / generous / decisive.
  - Interests & hobbies (max 3) — visible always; a ticket to start the conversation, never hidden.
- Seriousness & timing:
  - Intention: IMMEDIATE / SOON / EXPLORING / NOT_RUSHING — preference only.
- Female-specific (asked of the man as searcher):
  - Home skills expectations (cooking / home organization / child care / hospitality / budget management) — preference only.
  - Working wife vs housewife: ACCEPT_WORKING / PREFER_HOUSEWIFE / ANY — preference only, never strict. Topic left to the two partners.
  - Personal allowance (مصروف شخصي): EXPECTS / NOT_REQUIRED / DISCUSS_LATER / NOT_ASKED — preference only, no amounts ever.
- Contact & photos:
  - Photos before or after text acquaintance — preference only.
  - Preferred contact method — no direct call before trust.
  - Contact info exchange = premium benefit only.

14. Hard Rules
- Mandatory requirements.
- Distinct from preferences.

15. Photos & Media
- Main photo
- Additional photos
- Per-photo privacy

16. Verification
- Phone (OTP) — level 1
- Selfie — level 2
- ID card — level 3
- Verification badge (shows the highest level achieved only)
- Verification levels:
  - Level 1 (green): phone confirmed via OTP — implicit minimum.
  - Level 2 (blue): selfie matches the main photo.
  - Level 3 (gold): ID verified.
- Verification is always optional, free, and boosts trust, ranking, and completion percentage.
- Verification status belongs to the Applicant. Account verification and applicant verification are independent concepts.
- Badges distinguish verification (blue check) from the paid "متميز" shield — never confused.
- Periodic selfie refresh (e.g., every 6 months) prevents photo impersonation.

### 16b. Verification Levels ↔ Photo Visibility (F7)

| Level | Meaning | Badge | Grants |
|---|---|---|---|
| L1 | Phone confirmed via OTP | green | Account baseline; implicit minimum for participation |
| L2 | Selfie matches main photo | blue | Counts as "verified" for the "كل الموثّقين" photo-visibility tier |
| L3 | ID verified | gold | Highest trust; priority moderation signal |

Mapping to photo visibility tiers (Wasla_26 §7):
- **مطابقة محتملة (افتراضي)** — full photos to members who are current matches, regardless of their verification level.
- **كل الموثّقين** — full photos to members at **L2 or above** (selfie-verified). OTP-only (L1) members do **not** qualify for this tier.
- **كل المسجلين** — full photos to every registered member.

Badge shown to others is always the **highest achieved level only**; raw verification details are never exposed.

### 16a. Demo Accounts (Transparent Seed Profiles)
To avoid an empty site while real female members join, the platform may include demo profiles — always clearly labeled:
- Every demo account carries a permanent, visible "Demo / حساب تجريبي" label (badge + overlay).
- Demo accounts are excluded from matching, search, and messaging targets; they exist to demonstrate the experience only.
- A real member never interacts with a demo account unknowingly.
- Demo accounts never appear in counts shown to the public ("X women registered" counts real members only).
- Demo profiles are managed by the Admin Panel and removed when real members reach a configurable threshold.
- No fake real-looking accounts are ever created — this is the only sanctioned form of seeding.

17. Privacy
- Visibility
- Search visibility
- Last seen
- Photo privacy
- Profile pause
- Privacy settings apply to the Applicant's profile. The Account Owner's login information remains private and is managed separately.

## Internal Group Classification
Not visible to users. Every group is classified internally to support administration, APIs, and future analytics:
- Account Relationship (0) — System
- Basic Information (1) — Identity
- Residence & Nationality (2) — Personal
- Physical Appearance (3) — Physical
- Education & Culture (4) — Education
- Work & Financial Status (5) — Career
- Current Marital Status (6) — Family
- Children (7) — Family
- Health (8) — Health
- Personality & Lifestyle (9) — Lifestyle
- Religious Commitment (10) — Religious
- Interests & Hobbies (11) — Lifestyle
- About Me (12) — Personal
- Preferred Partner (13) — Preference
- Hard Rules (14) — Preference
- Photos & Media (15) — Personal
- Verification (16) — Trust
- Privacy (17) — Privacy

## V1 Strategy
Collect the minimum information needed for high-quality matching and encourage completion over time.

Additional profile groups may be introduced over time without affecting existing profiles — new groups are added through the Dynamic Field Rules and the Rule Engine rather than a schema change.

### V1 Core Groups (collected early, highest value)
- Basic Information (1)
- Residence & Nationality (2)
- Physical Appearance (3)
- Education & Culture (4)
- Work & Financial Status (5)
- Current Marital Status (6)
- Children (7)
- Religious Commitment (10)
- Interests & Hobbies (11)
- Photos & Media (15)
- Privacy (17)

### V1 Optional Groups (encouraged, never required)
- Personality & Lifestyle (9)
- About Me (12)
- Preferred Partner (13)
- Hard Rules (14)
- Verification (16)

### Later / Future Groups
- Health (8) — only if the user initiates it.

### Recommended Completion Path (after onboarding)
1. Basic Information → 2. Residence & Nationality → 3. Physical Appearance → 4. Education & Culture → 5. Current Marital Status → 6. Children → 7. Religious Commitment → 8. Interests & Hobbies → 9. Photo → 10. Preferred Partner

The recommended path prioritizes groups that most improve matching quality with the least effort.

## Group Completion
Each group defines:
- Completion rules (which fields count toward the profile completion percentage)
- Contribution to Matching, Search, Trust, or Recommendation
- Optional fields clearly labeled as improving match quality

## Cross-References
- Field metadata → [Wasla_05](Wasla_05_Profile_Fields.md)
- Dynamic visibility rules → [Wasla_06](Wasla_06_Dynamic_Fields_And_Rule_Engine.md)
- Storage strategy → [Wasla_07](Wasla_07_Data_Model.md)
- Master data → [Wasla_08](Wasla_08_Master_Data_And_Localization.md)
