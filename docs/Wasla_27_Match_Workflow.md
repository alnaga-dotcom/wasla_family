# Wasla 27 - Match Workflow

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Defines the lifecycle of a match relationship between two profiles. Referenced by Wasla_12 (Match Lifecycle) and Wasla_18 (Conversation); this is the missing workflow specification.

## Principles

- A match is a **bidirectional relationship between two ProfileIds**, stored once (Wasla_07).
- The Matching Engine computes compatibility (Wasla_12); the Workflow Engine manages the match state (Wasla_09); the Recommendation Engine decides what surfaces (Wasla_13); the Rule Engine decides eligibility (Wasla_11).
- A **true match requires both directions to pass their own hard filters** (Wasla_12).
- **Mutual like is the only gateway to a conversation** (decided, Wasla_18/24). Premium affects quotas, never the opening gate.
- **Block is terminal** for the match edge and is bidirectional (Wasla_07).
- Every transition publishes an event and is audited (Wasla_09, Wasla_10).

## Match Lifecycle

```
Calculated → Available → Viewed → Interested → Mutual → Conversation → Archived
```

Side branches:
- Available → (eligibility lost) → Recalculated / Expired
- Interested → (like withdrawn) → Viewed
- Conversation → Archived → (revisited) → Conversation
- Any state → Blocked (terminal)

## States

### 1. Calculated
The Matching Engine computed a compatibility score for a pair and **both directions passed their hard filters**. Not yet surfaced to anyone.

Trigger: MatchCalculated (Wasla_10).
Exit: → Available when the pair becomes eligible to surface (publish, trust threshold, privacy, no repetition).

### 2. Available
The candidate is eligible to appear in the viewer's Discover stack or search results (Recommendation Engine controls the actual display).

Trigger: MatchAvailable.
Exit: → Viewed when surfaced/opened; → Recalculated when either profile changes eligibility; → Blocked.

### 3. Viewed
The viewer opened/saw the candidate's profile. Drives freshness and recommendation feedback.

Trigger: MatchViewed.
Exit: → Interested (LikeSent); → Available (skip/next, no state change required beyond Viewed); → Blocked.

### 4. Interested
One side sent a Like. The like is private until matched — **"who liked you" is a premium benefit** (Wasla_17), while a like notification may still inform the receiver per Wasla_16 without revealing the identity to free members.

Trigger: LikeSent.
Exit: → Mutual (reciprocal LikeSent); → Viewed (LikeWithdrawn); → Blocked.

### 5. Mutual
Both sides liked each other. The conversation gate opens.

Trigger: MatchMutual.
Exit: → Conversation (ConversationStarted, Wasla_18 lifecycle takes over); → Blocked.

### 6. Conversation
An active conversation exists (Wasla_18 lifecycle: Not Started → Active → Muted → Archived → Closed → Deleted). The match edge remains open.

Trigger: ConversationStarted.
Exit: → Archived (mute/archive/inactivity); → Blocked.

### 7. Archived
A dormant match — conversation muted, archived, or inactive. It can be revisited.

Trigger: MatchArchived.
Exit: → Conversation (reactivated, a new message or mutual re-engagement); → Blocked.

### 8. Blocked (terminal)
Either side blocked the other. The edge is deleted from all discovery, search, and recommendation surfaces (Wasla_07: bidirectional; never undone by data cleanup).

Trigger: BlockAdded.
No exit.

## Transition Table

| Source | Target | Conditions | Trigger Event | Notification | Appeal | Timeout |
|---|---|---|---|---|---|---|
| Calculated | Available | Publish + trust threshold + privacy + no repetition + both directions passed | MatchAvailable | — | — | Recalc on profile change |
| Available | Viewed | Candidate surfaced/opened | MatchViewed | — | — | — |
| Viewed | Interested | Viewer sends Like | LikeSent | To receiver per Wasla_16 (identity gated by premium) | — | — |
| Interested | Mutual | Recipient sends Like back | MatchMutual + ConversationStarted | To both | — | — |
| Mutual | Conversation | Conversation created | ConversationStarted | To both | — | — |
| Conversation | Archived | Mute / archive / inactivity | MatchArchived | — | — | — |
| Archived | Conversation | Re-engagement | MatchUpdated | To both | — | — |
| Viewed | Viewed | Like withdrawn (before mutual) | LikeWithdrawn | — | — | — |
| Interested | Viewed | Like withdrawn (before mutual) | LikeWithdrawn | To receiver | — | — |
| Any | Blocked | Block by either side | BlockAdded | To blocker | Appeal (Wasla_09 Report/Appeal) | — |
| Available | Recalculated | Eligibility change (trust/account/privacy) | MatchUpdated | — | — | — |

## Rules

1. **One edge per pair**: a match is one stored relationship; both directions share it.
2. **No one-sided messaging**: conversation only after Mutual (Wasla_18).
3. **Block wins over everything**: a block removes the edge from every surface immediately and bidirectionally.
4. **Recalculation is safe**: after important profile changes (Wasla_12), the edge re-enters Calculated and, if still eligible, Available again.
5. **Anti-repetition is not a match state**: Ignored (Wasla_13) is a recommendation-level rule; the match edge remains but stops surfacing.
6. **No unexplained percentage**: Match reasons (Wasla_12) are generated only from viewer-visible facts.

## Golden Rule

A match is a promise of mutual consent: nothing is surfaced before it is eligible, nothing is shown to the wrong direction, nothing opens a conversation without mutual like, and nothing survives a block.

## Cross-References
- Matching → [Wasla_12](Wasla_12_Matching_Engine.md)
- Workflow Engine → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Recommendation → [Wasla_13](Wasla_13_Recommendation_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Messaging → [Wasla_18](Wasla_18_Messaging.md)
- Data Model → [Wasla_07](Wasla_07_Data_Model.md)
