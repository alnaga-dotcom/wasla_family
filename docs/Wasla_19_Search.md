# Wasla 19 - Search

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Search gives members an explicit way to find profiles. It is secondary to the Recommendation Engine (Wasla_13) and always respects the same hard filters, privacy, and gentleness rules as matching (Wasla_12).

Search is always initiated by the user and returns profiles that satisfy their explicit criteria. It never computes compatibility (Wasla_12) and never decides recommendation priority (Wasla_13).

## Search Pipeline

Search Request → Permission check (Rule Engine) → Candidate filtering → Search criteria → Sorting → Result set.

Before returning results the Rule Engine confirms: may this user search, which filters are allowed, and whether premium restrictions apply. The Search Engine never enforces business policy itself.

## Search Analytics (Anonymous)

Track anonymous metrics — most-used filters, empty searches, popular locations, search frequency — to improve both search and recommendations without identifying individuals.

## Objectives

- Search as a complement to discovery, not a replacement.
- Consistent with matching rules (never contradict them).
- Safe by design: protected data never searchable.
- Respects the "preference before hard rule" principle.

## Searchable Fields

Only fields explicitly flagged as searchable in Wasla_05 may be filtered:

- Basic: age (18–78), country, city
- Physical: height range, body type
- Marital: marital status
- Children: has children (yes / no)
- Lifestyle: smoking, daily routine
- Education: minimum level
- Profession: category
- Religiosity: level (preference)
- Intent: seriousness

Explicitly NOT searchable:
- Health / chronic conditions / medical barrier
- Financial details (personal allowance, derived stability indicator)
- Personal allowance
- Photos beyond the main photo
- TELL_LATER values (never a search value)

## Hard Filters in Search

Search results always pass both directions' hard filters (Wasla_12 §Hard Filters):
- A searcher never sees profiles that would fail the searcher's own hard rules.
- A searcher never sees profiles whose own hard rules would reject the searcher.

This keeps search and matching consistent: what you can find, you can match.

## Sort Order

- Relevance (matching score) — default
- Freshness (recently active)
- Newest profiles

## Result Display

- Only fields the viewer is allowed to see (privacy respected, Wasla_05).
- Match reasons shown when available (reason safety, Wasla_12).
- Protected values are never rendered, even if they influenced sorting.
- Text-first, compact cards: pseudonym, age, city, profession, lifestyle chips, match reasons.
- The main photo is a small thumbnail only, shown per the owner's chosen visibility level (Wasla_05): potential matches only / all verified members / all registered members — never the open web. Additional photos never appear in results; they unlock after mutual like.

## API Response Contract (F13)

`GET /search` and `/discovery/recommendations` (Wasla_29) share one response shape:

- **Items** carry only viewer-visible fields: pseudonym, age, city, profession, lifestyle chips, match reasons, verification badge level, and the small main-photo thumbnail (subject to the owner's visibility tier). Protected and hidden fields are **omitted**, never present as null (Wasla_21 §Privacy).
- **Exact contact and location data never appear** in results (no phone, no email, no street, no precise coordinates).
- Pagination uses `page` / `limit` and returns `nextCursor` when more items exist; counts never expose hidden-field statistics.
- Filter options (`/search/filters`) come from Master Data (Wasla_08) and include only searchable fields (this section).
- Presentation must never resemble a dating-app photo grid or swipe feed (no Badoo-style gallery).

## Advanced Search

- Combinable filters (age + city + education + religiosity).
- Saved searches (V1+).
- Notifications when a new profile matches a saved search (Wasla_16) — opt-in.

## Search Frequency & Anti-Abuse

- Rate limits per member per day (configurable).
- Admin configurable minimum trust level to use search (Wasla_14).

## Golden Rule

Search may never expose what matching would not: every result must also pass the match pipeline, and protected data never becomes a search filter.

## Cross-References
- Profile fields → [Wasla_05](Wasla_05_Profile_Fields.md)
- Hard filters → [Wasla_12](Wasla_12_Matching_Engine.md)
- Discovery → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Notifications → [Wasla_16](Wasla_16_Notification_Engine.md)
