# Wasla 15 - Content Moderation Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

The Content Moderation Engine is a Core Security Layer applied to every text field inside Wasla. It protects member privacy and platform integrity by detecting and handling prohibited content before it is stored or displayed.

## Governance Scope

Architecturally this is a **content governance** service, broader than moderation alone. It includes: text normalization, contact-information detection, link detection, social-platform detection, spam detection, abuse detection, AI-assisted classification, policy enforcement, manual review, and an audit trail. Moderation is one module inside this governance service.

## Scope

Every text input passes through the engine, not just the bio:
- About Me
- Desired Partner
- Messages (per policy)
- Comments (if any)
- Display names
- Any other text field

No screen or API contains moderation logic directly. All text goes through the engine first.

## What the Engine Detects

### Phone Numbers
All variants:
- 0123456789
- 012 345 6789
- 012-345-6789
- (012)3456789
- +20 123456789
- Zero One Two...
- ٠١٢٣٤٥٦٧٨٩ (Arabic-Indic digits)
- 𝟘𝟙𝟚𝟛... (mathematical digits)
- ⓪①②... (circled digits)

### Email Addresses
- name@gmail.com
- name @ gmail . com
- name(at)gmail(dot)com
- name [at] gmail [dot] com
- n a m e @ g m a i l . c o m

### Social Media & Messaging Apps
Prohibited mentions: WhatsApp, Telegram, Signal, Snapchat, Instagram, Facebook, TikTok, Discord, WeChat, LINE, Skype, and others.
Even disguised:
- "ابحث عني في إنستجرام"
- "تواصل عبر الواتس"

### URLs
Any direct or shortened link:
- https://...
- www...
- bit.ly
- tinyurl
- t.me
- linktr.ee
- others

### Word Obfuscation
Detected tokens: at, dot, underscore, dash, plus, three, zero, one, two — in multiple languages:
- at
- arroba
- نقطة
- دوت
- ات
- شرطة
- underscore

## Moderation Pipeline

Input
   │
   ▼
Normalizer
   │
   ▼
Language Detection
   │
   ▼
Pattern Detection
   │
   ▼
ML / AI Classifier (Future)
   │
   ▼
Risk Scoring
   │
   ▼
Decision

## Text Normalizer

Performs, in order:
- Unicode Normalization (NFKC)
- Remove Zero Width Characters
- Remove Invisible Unicode
- Remove Emojis (for checking only, never alters stored text)
- Remove Arabic diacritics (تشكيل)
- Unify Arabic letters: أ / إ / آ → ا; ة → ه (per rule); ى → ي
- Convert all digits to ASCII
- Remove excessive repetition
  - وووووووواتسسسس → واتس

## Evasion Detection

### Confusable Characters
e.g., gmaіl.com — the i is Cyrillic (і), not Latin. Normalized to gmail.com before checking.

### Homoglyph Detection
- 0 ↔ O
- 1 ↔ l ↔ I
- 5 ↔ S
- 8 ↔ B
- @ ↔ (a)

### Leetspeak
- 1nstagram
- te1egram
- wh4tsapp

### Arabic Chat Alphabet
- wa7tsapp (7 = ح)
- 3bdullah (3 = ع)
- Also 5, 2, 8, 9, 6 as used in Arabic chat.

### OCR-Resistant Writing
- g / m / a / i / l (one letter per line)
- g.m.a.i.l
- g_m_a_i_l

### Multi-language Detection
All forms yield the same result:
- واتساب, واتس, واتس اب, واتسآب
- WhatsApp, WApp, WA

## Dictionaries (Admin-Updatable)

No keywords live in code. Admin-maintained dictionaries:
- blocked_keywords.json
- blocked_domains.json
- blocked_social_apps.json
- blocked_url_shorteners.json

Updates take effect without a code deployment.

## Rule Engine

Each rule is independent:
- PhoneRule
- EmailRule
- URLRule
- SocialRule
- ProfanityRule
- SpamRule
- AdvertisingRule
- ExternalContactRule

RuleEngine
   ├── PhoneRule
   ├── EmailRule
   ├── URLRule
   ├── SocialRule
   ├── ProfanityRule
   ├── SpamRule
   ├── AdvertisingRule
   ├── ExternalContactRule

Adding a new rule does not require touching the rest of the system.

## Risk Scoring

Every text is scored, not just accepted/rejected:
- 0–20 → Accepted
- 21–60 → Review
- 61–100 → Reject

Examples:
- "أحب السفر والقراءة." → Risk 0
- "ابحث عني في إنستجرام." → Risk 80
- "name(at)gmail(dot)com" → Risk 100

Accepted content may additionally return a WARNING tier: the text is allowed, but the user receives a gentle, friendly guidance notice (e.g., a near-miss contact attempt that stayed within policy). This keeps the experience informative without blocking.

Risk scoring allows future rule additions without changing system interfaces.

## Structured Result

Never a simple true/false. Example:

{
  "allowed": false,
  "riskScore": 92,
  "status": "REJECT",
  "violations": [
    { "type": "PHONE", "confidence": 0.99, "matched": "+20 10..." },
    { "type": "SOCIAL", "matched": "WhatsApp" }
  ]
}

## User Experience

The engine never silently deletes or alters text. When content is rejected:
- The user sees a clear message: "لحماية خصوصية الجميع، لا يُسمح بإضافة وسائل تواصل أو روابط أو بيانات اتصال داخل الملف الشخصي."
- The save is refused until the user edits the text.
- The user is told which category caused the rejection, without exposing the detection internals.

## Human Review

- Auto-rejections and auto-acceptances handle the clear cases.
- Anything in the Review range, and any rejection disputed by appeal, goes to a human moderator.
- Negative decisions are confirmed by a person before they permanently affect an account.

## Reviewer Privacy & Masking (F23)

Moderation exists to keep the platform safe **without reading private conversations unnecessarily** (Wasla_18):

- A reviewer sees only the **flagged item** (message, photo, field), never the surrounding conversation history or the other party's content.
- Reviewer context is minimized: pseudonym instead of full name, no contact details, no exact location.
- **Sensitive content is masked by default**: protected values (Health, personal allowance, medical barrier) and contact-like strings (phone, WhatsApp, links) are shown as category placeholders ("[محتوى حساس]", "[رقم هاتف]") unless unmasking is strictly required to judge the flag — and unmasking is logged with the reviewer and reason.
- The reviewer never sees the profile's sensitive fields; only the single flagged value in context.
- Full-conversation reads are never a standard workflow and always require explicit, logged justification (Wasla_09 elevated approval).

## Appeals

Rejected content can be edited and resubmitted (per Wasla_09 content workflow), and any moderation outcome is appealable:
- Appeal → Re-Review → Overturned (content restored) OR Upheld.

## Logging

Every decision is logged:
- Original text (or a masked version when needed)
- Normalized text
- Matched rules
- Risk score
- Check timestamp
- User ID
- Field being checked
- Engine version

## Versioning

Every decision carries the engine version (e.g., Moderation Engine v1.4.2) so any decision can be traced to the exact rules that produced it.

## Whitelist & Context

Some legitimate uses are allowed:
- Company names containing "Telegram" or "Signal" in an acceptable context.
- Internal help pages or articles.
- Admin accounts, when policy permits.

The engine supports a whitelist and usage context, not blind word blocking.

## Privacy & Compliance

- Protected data (Health, per Wasla_05) never appears in moderation logs.
- Moderation logs follow the retention and masking rules of Wasla_07 and Wasla_10.
- The engine never scans protected fields.

## Configuration

Administrators configure:
- Risk thresholds
- Rule weights
- Dictionaries
- Whitelist entries
- Human review queue rules
- Enforcement level per field

## Golden Rule

No screen, API, or service applies its own moderation logic. Every text input passes through the Content Moderation Engine — the single decision point for what is accepted, reviewed, or rejected.

Second rule: the engine rejects and explains; it never silently deletes, and every rejection is reversible through edit or appeal.

## Cross-References
- Philosophy → [Wasla_01](Wasla_01_Philosophy.md)
- Product principles → [Wasla_02](Wasla_02_Product_Principles.md)
- Workflow & appeals → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Rules → [Wasla_11](Wasla_11_Rule_Engine.md)
- Trust → [Wasla_14](Wasla_14_Trust_Engine.md)
- Privacy & retention → [Wasla_07](Wasla_07_Data_Model.md)
