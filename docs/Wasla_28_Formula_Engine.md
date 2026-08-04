# Wasla 28 - Formula Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Formula Engine performs numeric calculation for every engine that produces a score. It is **pure mathematics with no policy**:

- Matching compatibility scores (Wasla_12)
- Profile quality (Wasla_12)
- Profile completion percentage (Wasla_05 §9)
- Trust score (Wasla_14)
- Recommendation rank (Wasla_13)
- Derived indicators (e.g., stability indicator, Wasla_05)

## Boundaries

| Concern | Owner |
|---|---|
| What is calculated | Formula Engine |
| **When** it is calculated | Rule Engine (triggers, eligibility) |
| **How it is used** (display, thresholds, features) | Rule Engine + consuming engine |
| Constants (weights, thresholds, coefficients) | Configuration Center (Wasla_08 §Config, Wasla_11) |

The Formula Engine never decides business policy, never exposes raw values, and never acts on a score.

## Principle: Rule decides, Formula computes

A Rule (Wasla_11) states *"when a profile is eligible for scoring and which calculator runs"*. The Formula Engine only evaluates the numeric expression. Example:

```
Rule:  "Compatibility is scored when both hard filters pass"
Formula: compatibility = Σ(weight_i × dimension_i)  |  hard filters already applied
```

## Score Types

### 1. Field Compatibility Calculators (Wasla_12)

| Calculator | Input | Output |
|---|---|---|
| Exact Match | two enum values | 1 if equal, 0 otherwise |
| Range Match | two ranges | overlap ratio 0–1 |
| Boolean Match | two booleans | 1 if consistent, 0 otherwise |
| Enum Match | one value vs allowed set | 1 / 0 / configured partial |
| Multi-select Overlap | two sets (max 3 each) | Jaccard or overlap ratio 0–1 |
| Distance Match | two locations | proximity score 0–1 (city granularity; no GPS) |
| Custom Calculator | configured expression | 0–1 |

All weights and per-calculator parameters come from Configuration; none are hardcoded.

### 2. Compatibility Score (aggregate)

```
compatibility = Σ( weight_i × dimensionScore_i )
              = Σ( weight_i ) = 1
```

- **No Preference** contributes 0 and never fails the match (Wasla_12).
- Hard filters are evaluated before scoring (exclusion, not weighting).
- Missing optional values are ignored (Wasla_12 Golden Rules).
- A true match requires both directions to pass hard filters.

### 3. Profile Quality

```
quality = w_v·verification + w_c·completion + w_p·photos + w_a·activity + w_r·reports_penalty + w_t·trust
```

- Photos missing → reduced contribution, never exclusion (Wasla_13).
- Reports/blocks appear as penalties only **after human confirmation** (Wasla_14).

### 4. Completion Percentage (Wasla_05 §9)

```
completion% = Σ( completedFieldWeight_by_tier ) + verificationBonus
```

- Tier 1 fields weighted highest, Tier 3 optional (05 §9b).
- Verification bonus: phone +5%, selfie +10%, ID +5%.
- Personal only — never shown to others.

### 5. Trust Score (Wasla_14)

```
trust = Σ( w_d · dimension_d )   → 0–100
dimensions: identity, profile, behavior, activity, verification
```

- Levels: 90–100 Excellent · 70–89 Good · 50–69 Fair · <50 Low.
- **Negative changes never apply automatically** — human review confirms, then the formula re-evaluates.
- The raw number is never exposed to other members; only the level and actionable factors.

### 6. Recommendation Rank (Wasla_13)

```
rank = w1·compatibility + w2·profileQuality + w3·freshness + w4·diversity_jitter + boost
```

- Freshness decays over time (configurable curve).
- Paid boosts add a transparent, time-boxed component (Wasla_13 sponsored transparency).
- Blocked/ignored/low-trust profiles are excluded by rules **before** ranking (Wasla_13).

### 7. Derived Stability Indicator (Wasla_05)

```
stability = f(profession_stability, housing, supports_parents)  → never asked, never shown raw
```

## Versioning

- Formulas are versioned like workflows (Wasla_09): Draft → Published → Archived.
- Existing scores remain under the version that produced them until a planned recalculation (Wasla_09 versioning, Wasla_12 performance).
- A recalculation is a background job that re-runs the published version and emits the relevant update events.

## Recalculation Triggers

Events that mark scores stale (Wasla_10):

- MatchUpdated (profile changed → compatibility recomputed)
- ProfileCompleted / ProfileUpdated (completion %, quality)
- VerificationPassed / PhotoApproved (quality, trust)
- TrustScoreChanged (trust → dependent scores)
- SubscriptionActivated (feature-related rank factors)

Recalculation is **incremental**: only affected scores and edges are recomputed (Wasla_12 performance).

## Explainability

- Every score is traceable to its contributing dimensions and weights.
- Match reasons (Wasla_12) and trust guidance (Wasla_14) are generated only from **viewer-visible** facts.
- The raw formula and raw values are never exposed to other members.
- No score is ever displayed without an explanation ("never show an unexplained percentage", Wasla_12 Golden Rules).

## Audit

- Every formula evaluation logs: formula version, inputs (references, not protected values), output, and triggering event.
- Protected data never enters logs (Wasla_10, Wasla_15).

## Golden Rule

The Formula Engine computes numbers; it never makes decisions. Rules decide when and whether, Configuration supplies the constants, and the platform explains every outcome it produces.

## Cross-References
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Recommendation → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Rule Engine → [Wasla_11](Wasla_11_Rule_Engine.md)
- Configuration → [Wasla_08](Wasla_08_Master_Data_And_Localization.md)
- Completion → [Wasla_05](Wasla_05_Profile_Fields.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
