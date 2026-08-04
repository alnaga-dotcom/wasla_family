# Wasla 18 - Messaging

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Messaging system enables conversations between members while protecting safety, privacy, and trust. It is a first-class feature with strong moderation and user control.

## Objectives

- Meaningful conversations between genuinely matched members.
- Safety through moderation without reading private conversations unnecessarily.
- Full user control (block, report, delete).
- No harassment and no external contact solicitation.

## Conversation Model

- A conversation is between two ProfileIds (Wasla_07).
- Conversations are created only after mutual like — both parties consent (decided, Wasla_24).
- Conversation metadata (Conversation entity) is separate from message content.

## Conversation Lifecycle

Not Started → Invitation (optional) → Active → Muted → Archived → Closed → Deleted (soft).

States are managed by the Workflow Engine (Wasla_09), never by direct status updates.

## Who Can Message

Defined by configuration and rules (Wasla_11), not hardcoded:
- Mutual like required — messaging opens only after mutual interest, i.e., both parties consent. Premium affects quotas, never the opening gate.
- No one-sided messaging: a conversation only exists after both sides agree.
- Never against a user who blocked or reported the sender.

## Conversation Model

- Real-time chat inside the platform.
- Contact details are never required for conversation — everything happens in-app.

## Messaging Quota & Permissions (V1)

- Free members: 5 messages per day.
  - The quota counts only messages the member sends; replying to an incoming message does not consume it.
  - Messages must not contain prohibited contact data: phone numbers, emails, external links, or any contact solicitation (enforced by the Content Moderation Engine, Wasla_15).
  - When the daily quota runs out, one quiet in-app notification appears ("come back tomorrow or upgrade") — never a push, never repeated, never shaming.
- Premium members: unlimited messaging (V1).
- Permissions and quotas are configurable (Wasla_11, Wasla_17), never hardcoded.
- Future: permissions will be refined and an ultimate account tier introduced (outside V1).

## Exchanging Contact Info

- Exchanging contact info in free text (phone / WhatsApp / external links) is blocked for all members — the Content Moderation Engine refuses such content even for premium in V1.
- The "Share contact" benefit is a **structured, in-app premium action**: after mutual like, the sender shares their chosen contact method through a dedicated, recorded control — never through free text. This is the premium "contact-info exchange" entitlement (Wasla_17).

## Message Lifecycle

Draft → Sent → Delivered → Read

- Draft: composed, not yet sent.
- Sent: accepted by the platform.
- Delivered: reached the recipient's device.
- Read: opened by the recipient.

Moderation and anti-spam apply before "Sent".

## Message Types

- Text messages only.
- Voice notes (audio messages) are not allowed in the app — V1 and future, unless explicitly reconsidered.
- Photos: regular photos and ephemeral photos ("appear and disappear", no save, no screenshot, no download) are supported per Wasla_05 Photo rules.
- No other media in V1.

## Content Moderation (Critical)

Every message passes through the Content Moderation Engine (Wasla_15) before delivery:

- Contact details, links, and social solicitations are blocked.
- The sender sees a clear message explaining why the message was refused.
- High-risk content is flagged for human review.
- Blocked content can be edited and resubmitted.

Sensitive data (Wasla_05) never appears in moderation logs.

## Anti-Harassment

- Users can block at any time. Blocking stops all contact and hides the conversation (Wasla_07).
- Users can report a conversation or a message; reports are human-reviewed (Wasla_09).
- A user can delete a conversation for themselves.
- A user cannot message someone who blocked them, even via premium.

## Message Deletion

- A user can delete their own messages.
- Platform-side deletion applies when content violates policy.
- No deletion bypasses the audit trail (Wasla_07, Wasla_10).

## Notifications

Message notifications are delivered through the Notification Engine (Wasla_16) and respect per-type preferences.

## Privacy

- Read receipts and online status follow user settings (Wasla_04 Privacy group).
- Message previews never leak sensitive content in push notifications.
- Conversations are never exposed to third parties except as required by law, handled per Security (Wasla_22).

## Golden Rule

Messaging exists to build trust through conversation — never to expose members to harassment, deception, or external contact solicitation. Safety controls are mandatory, moderation is automatic, and the user always has the last word.

Second rule: no message reaches a recipient without passing content moderation first.

## Cross-References
- Content Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Workflow & appeals → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Notifications → [Wasla_16](Wasla_16_Notification_Engine.md)
- Website design → [Wasla_24](Wasla_24_Website_Design.md)
