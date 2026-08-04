# Wasla 24 - Website Design Specification

> Part of the [Wasla Documentation Index](Wasla_README.md)
> Derived from Wasla_01 through Wasla_14.

## Purpose
Define the complete visual and interaction design of the Wasla platform: the member application and the admin panel.

## Design Principles

Derived from Wasla_02:

- **One Screen = One Goal**: every screen focuses on one logical task.
- **Encourage, Never Force**: positive reinforcement over long forms.
- **Facts Over Opinions**: structured, measurable inputs with visual controls.
- **Trust Before Contact**: verification and moderation are visible, first-class.
- **Explain Every Match**: every compatibility score shows its reasons.
- **Privacy by Default**: users control what others see.
- **Mobile-First**: thumb-friendly, one-column layouts, bottom navigation.
- **Multilingual from Day One**: full RTL support for Arabic, LTR for English.

## Brand Identity

### Logo: The Knot (Decided)

A simple geometric knot — never nautical, never tangled. It must read instantly as:

- **Connection** (وصلــه = a link/connection)
- **Commitment** (the knot binds)
- **Strength** (the knot holds)
- **Unity** (two ends becoming one)

While abstracting into the letter **W** (for the Latin/transliterated brand). No people, no hearts, no mosque, no crescent — only the knot.

Design constraints:
- Maximum simplicity; at 32px (favicon/app icon) it must remain readable.
- Built from smooth, single-width geometric strokes; rounded joins.
- Animated-friendly: the knot may **tie itself** on splash/load (one loop, 800–1200ms, then settles) — "the connection being made".
- Lockups: (1) mark alone, (2) mark + wordmark "Wasla" (Latin, Inter), (3) mark + wordmark "وصلــه" (Arabic, Cairo/IBM Plex Sans Arabic).
- Monochrome version required (watermarks, stamps, verification contexts).
- Must never resemble the blue verification badge or the gold premium shield.

### The Knot — Construction Spec (for Figma)

Geometry (128×128 grid):

1. **Two interlocking arcs** — each arc is one continuous stroke (no dots, no open ends): left arc opens up-right, right arc opens up-left.
2. The arcs **overlap at the vertical center** (crossing point ≈ x=64, y=64) — this crossing is what makes it "the knot", not two separate brackets.
3. **Overlap rule**: the crossing renders as *under-over* (like a Celtic interlace) — in Figma, split the crossing strokes and re-order so the left strand passes over then under. Do not fake it with opacity; the interlacing must be real geometry.
4. Together the two arcs must read as a **W**: left arc forms the first valley, the crossing forms the peak, right arc forms the second valley.
5. **Stroke**: single width, rounded caps, rounded joins. Width ≈ 12px on the 128px grid (scales down cleanly).
6. **Bounds**: mark fits in a square with ~12px breathing room; no stroke touches the edge.
7. **Orientation** is static — the knot is only "tied" by the splash animation, not by rotating the final mark.
8. **Version A (primary, burgundy)** for app icon and brand surfaces; **Version B (gold #D4A437)** for premium contexts; **Version C (monochrome)** for watermark/stamp.

Animation spec (splash/load):
- Duration 800–1200ms, ease-in-out, single loop.
- Start: the two strands untied (two separate arcs apart).
- End: the arcs slide together and the crossing ties — settle at the static mark.
- No bounce, no rotation — a calm "connection being made" (matches elegance standards).

### Slogan / Tagline (Official)

- English: **"Connect Hearts, Building Families."**
- Arabic (official): **"نربط القلوب... لنبني أسراً مستقرة"**
- Used as the landing page hero headline and app store tagline; the core promise that ties to Wasla_01 (marriage as a dignified journey, family-building).

## Design Language

### Colors

Elegant, warm, dignified Islamic style — decided direction (burgundy replaces olive):

- Primary: Burgundy (dignity, warmth, tradition) — #7B2D36
- Primary soft: Burgundy tint for surfaces — #F3E7E8
- Secondary: Warm Gold (premium, highlight) — #D4A437
- Neutrals: Off-white background (#F7F5F2), Ink text (#1E1E1E)
- Success: #2E7D32 | Warning: #ED6C02 | Error: #C62828
- Verification badge: blue check (L2/L3), distinct from the gold premium shield

### Typography
- Latin: Inter (UI) + Playfair Display (headlines, optional)
- Arabic: IBM Plex Sans Arabic / Cairo
- Scale: 12 / 14 / 16 / 20 / 28 / 36 px

### Shapes & Motion
- Large rounded corners (16-24px cards), soft shadows
- Bottom sheet modals on mobile, centered cards on desktop
- Micro-animations (150-250ms) for likes, matches, badges

### Layout
- Mobile: single column, bottom tab bar (Home / Likes / Messages / Profile)
- Desktop: centered content (max 480px forms, 720px profile, full recommendations grid)

## Information Architecture — Member App

### Public (No Login)
1. Landing page
2. Login
3. Register (one minute flow)
4. Terms & Privacy (static)

### Onboarding (After Register)
1. Welcome
2. Basic info (name, gender, DOB, country)
3. Photo upload
4. Verification (optional, encouraged)
5. Dynamic profile groups (progressive, one group per screen)

### Main App (Authenticated)
1. **Home / Discover**: swipe-style card-stack recommendations (A1 decided — kept)
2. **Matches**: people who mutually match
3. **Search** (advanced users)
4. **Likes & Favorites**: who liked you, favorites list
5. **Messages**: conversation list + chat
6. **Profile**: own profile view + edit
7. **Profile Completion**: percentage + missing sections
8. **Notifications**: in-app center
9. **Settings & Privacy**
10. **Subscription / Premium**

## Screen Specifications — Member App

### 1. Landing Page
- Value proposition headline: **"نربط القلوب... لنبني أسراً مستقرة"** / **"Connect Hearts, Building Families."**
- "Find your وصلــه" CTA
- Trust badges (verification, privacy, moderation)
- Login / Register buttons
- Language toggle

### 2. Registration (One Screen)
- One field at a time (or compact multi-step)
- Method picker: Google / Facebook / Phone / Email
- If phone: OTP screen with countdown + resend
- Collects: provider, name, gender, DOB (validates age 18–78), country
- Terms & Privacy checkbox
- Goal: < 60 seconds

### 3. Welcome / Onboarding Start
- Completion percentage = 0%
- "We will help you step by step"
- Continue later option always visible

### 4. Basic Information
- Display name (moderated)
- Gender (Master Data chips)
- Date of birth (picker, validates age 18–78)
- Country (master data, searchable dropdown)

### 5. Photo Upload
- Main photo (never a registration requirement; improves matching quality)
- Additional photos (optional)
- Ephemeral photos: view-once / time-limited, no save, no screenshot, no download
- Per-photo privacy toggle with three levels (Wasla_05): potential matches only (default) / all verified members / all registered members — never public on the open web
- AI moderation status shown (pending / approved / rejected)
- Verification selfie optional but rewarded

### 5a. Photo Specifications (F11)
- **Count**: main photo + up to 4 additional (max 5 in V1), configurable. Ephemeral photos do not count toward the limit.
- **Formats**: JPEG / PNG / WebP. No GIF, no video, no audio.
- **Sizes**: upload limit 10 MB per file; recommended display 1200 px on the long edge.
- **Compression**: server resizes to standardized variants (small / medium / full) for lists vs profile vs lightbox; originals kept only during moderation then replaced by processed variants.
- **Selfie refresh (expiry)**: the verification selfie expires after 6 months (Wasla_04 §16). On expiry the badge downgrades to the previous level, the member is notified with one gentle in-app nudge, and re-verification restores the badge. It never blocks or locks the account (Wasla_14: no automatic penalties).
- **Watermarking/protection**: full-resolution images carry a subtle member-ID watermark to trace leaks (Wasla_22).

### 6. Dynamic Profile Groups
One screen per group from Wasla_04, in onboarding order:
- Residence & Nationality
- Physical Appearance (sliders + palettes)
- Education & Culture (chips)
- Work & Financial Status
- Current Marital Status (dynamic follow-ups via Rule Engine)
- Previous Marital History
- Children
- Health (optional)
- Personality & Lifestyle (factual toggles only: smoking, routine, money habit)
- Religious Commitment (self-described practice level, prayer habit optional)
- Interests & Hobbies (multi-select chips, heavily used in matching)
- About Me (free text with live Content Moderation)
- Preferred Partner (directional preferences from Wasla_04 §13)
- Hard Rules (only identity-level exclusions; everything else stays a preference)

### 7. Discover (Home)
- Card stack (mobile) / grid fallback (desktop) — swipe cards primary interaction (A1 decided)
- Swipe right = Like, swipe left = Skip (with tap buttons as fallback for accessibility)
- Each card: photos, name/age/city, verification badge, match reasons chips
- Actions: Skip / Like / Favorite
- Like quota indicator (5/day free members; unlimited premium)
- Completion nudge: "Complete your profile to get better matches"
- No repeated profiles (anti-repetition)
- Undo (limited, configurable)

### 8. Search (Advanced Users)
- Deliberate, text-first browsing — the opposite of a photo gallery or swipe feed.
- Results cards are compact and values-first: pseudonym, age, city, profession, key lifestyle chips, match-reason chips.
- The main photo appears only as a small, modest thumbnail — always per the owner's chosen visibility level (Wasla_05): potential matches only / all verified members / all registered members.
- Additional photos are never shown in results; they unlock only after mutual like.
- No swipe gestures in search; explicit filters and sorting (relevance, freshness, newest).
- Presentation must never resemble a dating-app photo grid or feed (explicitly: no Badoo-style gallery).
- Actions on a result: View profile / Like / Favorite / Block / Report.

### 9. Profile Detail (Other Member)
- Photos with privacy handling
- Verified badge + trust signals (only safe fields)
- Compatibility score with **explainable reasons** (never unexplained %)
- Mutual interest callout
- Actions: Like / Favorite / Block / Report
- Message button only after mutual like; premium affects quotas, never the opening gate

### 10. Messages
- Conversation list with last message preview
- Chat: bubbles, typing indicator, photo sharing (moderated)
- Opens only after mutual like (both parties consent)
- Real-time in-app chat; contact details never required
- Free members: 5 likes/day and 5 messages/day (replying doesn't consume quota); one quiet in-app notice when quota runs out
- Premium members: unlimited likes and messages (V1)
- Inline moderation warning when content is blocked
- Report / block within a conversation

### 11. Own Profile & Edit
- Section-by-section editing
- Completion percentage + "what's missing" callout
- Completion Steps checklist: clear actions with their percentage contribution (+5 photo, +10 selfie, etc.) — personal, never shown to others
- Each field follows Field Definition Framework metadata
- Dynamic fields appear per Rule Engine

### 12. Verification Hub
- Verification levels: L1 phone (green), L2 selfie (blue), L3 ID (gold)
- Phone / Email / Selfie statuses (Pending / Processing / Passed / Failed)
- Step-by-step selfie flow
- Badge preview (highest level shown only)
- Completion percentage contribution shown (+5 phone, +10 selfie, +5 ID)
- Why verification matters (trust, ranking, visibility)
- Periodic selfie refresh reminder (e.g., every 6 months)

### 13. Notifications
- Likes, matches, messages, verification results, moderation results
- In-app list + optional push/email

### 14. Settings & Privacy
- Language, country, visibility toggles
- Search visibility, last-seen, photo privacy, profile pause
- Delete / deactivate account (workflow-driven)

### 15. Subscription / Premium
- Plan cards (monthly / yearly)
- Feature comparison (visible badges, boost, unlimited likes)
- Payment screen
- Status shown in Profile

## Information Architecture — Admin Panel

### Screens
1. **Dashboard**: KPIs (registrations, active, matches, reports, revenue)
2. **Users & Profiles**: list, detail, state machine actions
3. **Verification Queue**: review selfies/docs, approve/reject
4. **Moderation Queue**: flagged content, reports, decisions
5. **Master Data Manager**: manage all master lists + translations
6. **Rule Engine Builder**: create/test/enable rules
7. **Workflow Manager**: view/configure state machines
8. **Matching Weights**: configure scoring calculators
9. **Recommendation Configuration**: sources, weights, rotation
10. **Trust & Verification Config**: factor weights, thresholds, actions
11. **Event Explorer**: browse, filter, replay events
12. **Subscriptions & Payments**: plans, invoices, refunds
13. **Reports & Analytics**: charts, exports
14. **Admin Roles & Audit**: RBAC, audit log (per Wasla_25 Roles & Permissions)

### Admin Design Notes
- Dense tables, filters, bulk actions
- Approve/reject inline with reason
- Risk scores surfaced with rule traces
- Every action is an event (audited)
- Dark sidebar navigation, role-based views

## Global Components

- **Verification Badge**: shown on profile cards, detail, chat headers
- **Match Reason Chips**: "Same city", "7 shared interests", "Same religion"
- **Completion Bar**: profile completeness indicator
- **Moderation Status Chip**: pending / approved / rejected
- **Empty States**: friendly guidance ("Complete your profile first")
- **Toasts**: like sent, message blocked, report submitted

## Navigation Model

- Guest: top bar → Login / Register
- Member (mobile): bottom tabs — Home, Likes, Messages, Profile
- Member (desktop): left sidebar — Discover, Matches, Search, Likes, Messages, Profile, Settings
- Admin: left sidebar with role-filtered sections

## Notifications & Events Mapping

Each significant event (Wasla_10) has a corresponding UI surface:
- MatchCalculated → Matches tab badge
- LikeSent → Likes feedback toast
- MessageSent → Chat + notification
- VerificationPassed → Badge + notification
- ContentRejected → Inline field error + reason

## Gentleness in UI (Principle 5a)

The UI never judges or labels a member:
- Preference mismatches are never framed as rejection — phrased as "you two can talk about this".
- TELL_LATER ("will tell you later") is presented as a gentle, positive option, not as a refusal.
- The medical-barrier disclosure (premium) opens in a calm, private flow, never intrusive.
- Hard-rule exclusions show a neutral reason ("your preferences don't align here") without shaming.
- Completion nudges explain the benefit of each missing field ("Adding your profession improves your matches").

## UI Notes for New Decisions

- Weight: shown as body type (slim / athletic / average / fuller); the number stays private.
- Glasses: display-only chips (glasses / contact lenses / none / tell you later) — never matched.
- Personal allowance (مصروف شخصي): shown to potential matches only, never on public pages, no amounts.
- Contact info exchange is a premium feature; the button appears only for eligible premium members.
- Voice notes are not part of the chat composer (text + photos only).

## Elegance Standards

Elegance is a core product value (Wasla_02), not decoration. The design must feel calm, dignified, and trustworthy — never flashy or cheap:

- Whitespace is generous; density is the enemy of trust.
- One accent color (burgundy) + gold for premium only — no rainbow layouts.
- Cards use large rounded corners and soft shadows; no harsh borders.
- Typography: elegant Arabic (Cairo/IBM Plex Sans Arabic) with correct RTL; generous line height.
- Photography: real, warm, modest imagery — never suggestive or Western-lingo style.
- Empty states and loading are branded and calm, never grey walls.
- Motion is subtle (150–250ms) and meaningful; no bouncing or playful gimmicks.
- Every screen is checked for "would a mother approve of this page?" — a firm quality gate.

## Member Growth — Female Presence (Launch Strategy)

The platform lives or dies by having real female members; without them, men leave and the site stalls. This is a product-strategy concern surfaced here because it shapes design and messaging:

- Female profiles are never displayed to the public or to unregistered visitors — privacy first (Wasla_05).
- Launch targets female sign-ups through trusted channels: family/guardian registration (levels c/d), outreach by female coordinators, and word-of-mouth within communities.
- The landing page may show honest aggregate signals ("X women registered in your city") without any photos or names — real members only, never demo counts.
- Registration and onboarding for women must feel safe, respectful, and discreet — the gentlest experience on the platform.
- Female-only support channel (staffed by women) increases trust among families.
- Premium pricing stays identical for both genders (no "pay to see women" model — that destroys trust and matches the 066.city adapted model poorly).
- While real female members join, demo profiles (Wasla_04 §16a) may be shown, always clearly labeled "حساب تجريبي / Demo", never matched, never counted as real, and never interacted with unknowingly.

## Accessibility & Internationalization
- RTL/LTR complete mirroring, no hardcoded strings
- ARIA labels, keyboard navigation for forms
- Color-contrast compliant (WCAG AA)
- Font loading for Arabic glyphs
- No placeholders as labels

## Screen Inventory (F12 — missing member screens)

Consolidated member screens beyond those specified in §1–§9. Admin screens are specified by endpoint in Wasla_29 and by module in Wasla_20; the admin panel is a separate application (Open Question 4).

### Login / Register (Auth)
- Single screen with two states (login | register); OTP-by-phone is the primary flow, email/password secondary; social (Google/Facebook) with account linking per Wasla_03.
- Register is minimal: name + phone/email + password, per the "registration under 60 seconds" rule (Wasla_26).
- One clear CTA; privacy reassurance line ("بياناتك مشفرة ولن تُنشر أبدًا"); link to Terms & Privacy.
- Rate-limited, error envelope per Wasla_21; Arabic digits for OTP inputs.

### Profile Completion
- The onboarding checklist (§5/§6) with the completion % personal dashboard (Wasla_05 §9e).
- One screen, one goal (Wasla_05 §9c): shows current percentage, the next step and its contribution, tier-ordered nudges (photo → selfie → profession → sensitive).
- Never shames, never blocks; sensitive fields never named in nudges.

### Matches
- The mutual matches list: compact cards with pseudonym, age, city, match reasons, verification badge; photo thumbnail per the owner's visibility tier.
- Opens the conversation only after mutual like (Wasla_18); archive/block actions per Wasla_27.
- Empty state is calm and branded ("ستظهر المطابقات عندما يوافق الطرفان").

### Likes & Favorites
- **Likes**: members who liked you / you liked — status badges (received/sent/mutual) drive the "الإعجاب المتبادل" gate; tapping a received like offers Like Back / Pass / View reasons.
- **Favorites**: a private bookmark list for the user's own review (Wasla_07); never signals to the target, no notification.

### Terms & Privacy
- Clear, localized (Arabic-first) pages; plain-language summaries on top, full legal text below.
- Sections: data collected (Wasla_03/05), what is never stored or published, photo visibility levels, deletion rights, contact & complaints.
- Linked from registration and footer; consent is recorded and retrievable (Wasla_23 compliance).

## Open Questions (To Confirm)

1. ~~Swipe cards vs. tap-based recommendations UI?~~ ✅ Decided: swipe cards (tap buttons as fallback).
2. ~~Does messaging require mutual like first, or premium bypass?~~ ✅ Decided: mutual like only; quotas per Wasla_17.
3. Photo visibility: per-photo levels — potential matches only (default) / all verified members / all registered members; never public on the open web. Additional photos unlock after mutual like; per-photo privacy governs sensitive photos.
4. Admin panel: separate application from the member app (own build, RBAC, isolated sessions).
5. V1 scope: Progressive Web App (PWA) — installable on mobile and usable on desktop; offline support is minimal in V1.

## Next Steps

1. Confirm open questions.
2. Produce wireframes per screen (HTML prototype phase).
3. Define component library.
4. Map screens to APIs (pending Wasla_21 API Design).
