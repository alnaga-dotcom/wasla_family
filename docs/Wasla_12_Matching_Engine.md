# Wasla 12 - Matching Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
The Matching Engine calculates compatibility between two profiles using configurable business rules.

It determines **how compatible** two applicants are. It does not decide what to recommend, what to display, or whether communication is allowed — those belong to the Recommendation Engine, Rule Engine, and Workflow Engine respectively.

## Eligibility Before Matching
Before compatibility is calculated, the Rule Engine determines whether matching is allowed at all:
- Profile published
- Verification / completion requirements met
- Subscription restrictions
- Trust threshold
- Account status

The Matching Engine never evaluates business policy itself.

## Formula Engine Integration
Scoring formulas are not hardcoded. The Formula Engine performs calculations (weights, distance, overlap); the Matching Engine orchestrates the process.

## Match Lifecycle
Matches have their own lifecycle — Calculated → Available → Viewed → Interested → Mutual → Conversation → Archived — managed by the Workflow Engine (Wasla_09).

## Design Goals
- Explainable results
- Bidirectional matching
- Configurable weights
- High performance
- No hardcoded scoring

## Matching Pipeline

1. Hard Filters
2. Preference Matching
3. Bonus Scoring
4. Profile Quality
5. Final Ranking

## Hard Filters
Examples:
- Gender
- Age range
- Religion (if mandatory)
- Accept children
- Relocation

Profiles failing a hard filter are excluded.

### Hard Filters Are Directional
Each profile has its own hard filters. A can pass B's filters while B fails A's filters. Matching is stored as a relationship between two profiles, and a true match is only presented when both directions pass their own hard filters.

### Hard Filters vs Privacy
- Hard filters may use internal values that are not displayed to the other user.
- Match reasons must never reveal data the viewer cannot see. If a dimension is hidden, its reason is replaced with a generic one or omitted.
- Protected fields (Health) never participate in hard filters, matching, or ranking.

## Match Categories
- Hard Rules (exclusion: failure excludes the profile)
- Preferences (scoring: contributes positively or neutrally)
- Bonus Factors (adds to the score without penalizing absence)

### No Preference
When a user selects "No Preference" for a dimension, that dimension contributes neither positively nor negatively to the score, and never fails the match.

## Weight Configuration
Weights are managed from the Admin Panel.

Examples:
- Religion
- Age
- Height
- Education
- Lifestyle
- Interests

## Scoring Calculators
- Exact Match
- Range Match
- Boolean Match
- Enum Match
- Multi-select Overlap
- Distance Match
- Custom Calculator

## Profile Quality
Independent score based on:
- Verification
- Completion
- Photos
- Activity
- Reports
- Trust

## Final Rank
Final ranking combines:
- Compatibility Score
- Profile Quality
- Freshness
- Recommendation adjustments

## Match Reasons
Always explain matches, e.g.:
- Same religion
- Same city
- 3 shared interests (max list)
- Both accept relocation

### Reason Safety
- Reasons show facts the viewer is allowed to see.
- If a contributing value is hidden, the reason is generalized or omitted, never leaked.
- No reason ever references protected data (Health).

## Score Ladder & Default Threshold (F10)

The compatibility score is a 0–100 aggregate (Formula Engine, Wasla_28). The ladder is shown as a level, never as a raw number:

| Level | Range | Meaning |
|---|---|---|
| High | 80–100 | Strong match — shown first, surfaced as "توافق مرتفع" |
| Medium | 60–79 | Good match — normal position |
| Low | below 60 | Weak match — normally not recommended |

**Default threshold: 60.** Below the threshold a profile is not presented as an available match (Hard Rules still exclude regardless of score). The threshold is a Configuration Center value (Wasla_08), admin-adjustable, and the ladder is what the user ever sees — never the numeric score.

## Performance
- Precompute matches in background.
- Recalculate after important profile changes.
- Cache top recommendations.

## Golden Rules
- Never show an unexplained percentage.
- Ignore missing optional values.
- Matching is a relationship between two profiles; a true match requires both directions to pass.
- Match reasons never leak hidden or protected data.
- No Preference never penalizes.

## Cross-References
- Profile groups → [Wasla_04](Wasla_04_Profile_Groups.md)
- Sensitive fields → [Wasla_05](Wasla_05_Profile_Fields.md)
- Rule safety → [Wasla_06](Wasla_06_Dynamic_Fields_And_Rule_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Recommendation → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
