# Wasla 13 - Recommendation Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
The Recommendation Engine decides which profiles are presented to each member.

It determines **which eligible applicants to show and in what order**. It does not calculate compatibility (Wasla_12) and it does not return search results (Wasla_19).

## Difference from Matching
- Matching calculates compatibility between two profiles.
- Recommendation selects and ranks profiles to display.

## Rule Engine & Formula Engine Integration
Eligibility is confirmed through the Rule Engine (recommendation allowed, policy active, premium rules). Ranking weights are supplied by the Formula Engine from configuration — ranking never embeds business policy or hardcoded math.

## Recommendation Sources
- Top compatibility
- New members
- Verified members
- Recently active
- Nearby members
- Freshly updated profiles
- Editorial/Admin campaigns (future)

## Recommendation Pipeline
1. Generate candidates
2. Apply hard filters (both directions, per Wasla_12)
3. Exclude blocked, blockers, and accounts below the minimum trust threshold
4. Load compatibility score
5. Apply Trust Score
6. Apply freshness score
7. Diversity rotation
8. Final ranking

## Verification Ranking Effect

- Verified members receive a configurable ranking multiplier in the recommendation pipeline (not a fixed cutoff).
- The multiplier is applied as a factor to the final ranking, set from the Admin Panel (e.g., L2 selfie and L3 ID verified profiles get a defined boost).
- Verification never makes an incompatible profile appear; it only raises the rank within the existing quality and compatibility rules.
- A member is never excluded for being unverified — verification only increases visibility.

## Mutual Fit Requirement
A profile is only recommended when both directions pass:
- The candidate passes the viewer's hard filters.
- The viewer passes the candidate's hard filters.

This maximizes the chance of meaningful conversations and avoids recommending profiles that would reject the viewer.

## Exclusion Rules (Mandatory)
- Blocked profiles and users who blocked the viewer are never recommended.
- Accounts below the configured minimum trust score are not recommended.
- Profiles with no accepted photo are ranked lower, not excluded. A main photo is never a registration or recommendation requirement — it improves quality (Wasla_05 Photos). This aligns with "encourage, never force" (Wasla_02).

## Freshness
Boost profiles that recently:
- Completed profile
- Added photos
- Passed verification
- Returned after inactivity

## Diversity
Avoid showing the same people repeatedly.
Rotate candidates while preserving quality.

## Anti-Repetition
If a profile is ignored repeatedly:
- Reduce ranking
- Stop showing temporarily
- Reconsider after meaningful profile updates

## Recommendation History
Store:
- Viewer
- Recommended profile
- Timestamp
- Source
- Position
- Opened?
- Liked?
- Ignored?

Ignored is an explicit user action ("don't show this profile again"), recorded separately from simply not opening a card.

## Recommendation Reasons
Every recommendation carries an explainable reason:
- "Matches your preferences"
- "New member"
- "Verified"
- "Recently active"
- "In your city"

Reasons never reveal hidden or protected data, consistent with Wasla_12.

## Location & Proximity (F9)

- Location granularity is **city-level** only. No GPS, no street, no live location, no radius in meters (Wasla_12 Distance Match).
- The location used for "nearby" / "in your city" is the member's **selected city** from Master Data (Wasla_08), never device location.
- No permission is requested or stored for device location. The profile city is declared data, editable by the user, and fully private from non-viewers (Wasla_05 privacy).
- Expatriation ("outside the country") is a separate dimension, never derived from coordinates (Wasla_05 Relocation example).

## Sponsored Transparency
Editorial/Admin campaigns, if they include paid placements, are always:
- Clearly labeled as sponsored or promotional.
- Subject to the same exclusion and privacy rules as organic recommendations.
- Never shown to a user who blocked the advertised profile.

## Configuration
Administrators configure:
- Source weights
- Rotation rules
- Freshness boost
- Daily limits

## Future AI
Future versions may learn from:
- Opens
- Likes
- Messages
- Successful matches

## Golden Rule
Recommendations should maximize the chance of meaningful conversations, not simply display the highest compatibility scores.

Second rule: every recommendation is explainable, exclusions are mandatory, and sponsored placements are always labeled.

## Cross-References
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Search (advanced) → [Wasla_19](Wasla_19_Search.md)
