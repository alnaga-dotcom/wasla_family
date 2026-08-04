# Wasla 03 - Registration

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
Define a frictionless registration flow that maximizes completed sign-ups while collecting only essential information.

## Goals
- Registration as short as the method allows (social < 1 min, phone/email up to 3 min).
- Progressive profile completion.
- High conversion.
- Strong account security.

## Supported Methods
- Google
- Facebook
- Phone Number (OTP)
- Email

## Registration Levels (a / b / c / d)

Gender and role determine the registration level. Referenced across the docs (Wasla_04, Wasla_05, Wasla_06):

- Level a — Man seeking a woman (man's own profile).
- Level b — Woman seeking a man (woman's own profile).
- Level c — Third party registering a male relative (e.g., a guardian registering his son/nephew).
- Level d — Third party registering a female relative (e.g., a guardian registering his daughter/sister).

Rules:
- Levels c / d require explicit guardian consent and proof of relationship before activation.
- The level fixes which directional questions apply (Wasla_04 §13) and never changes silently.
- A profile's gender is determined at registration and cannot be changed later.

## Registration Data
Collect only:
- Login provider
- Email or phone (depending on method)
- Display name (if needed)
- Gender
- Date of birth
- Country
- Acceptance of Terms & Privacy

### Profile For (conditional)
Immediately after the login method, ask once:

- Who is this profile for?
  - Myself
  - A Relative

If "A Relative" is chosen (levels c / d), show one conditional field:

- I am the applicant's... (RelationshipToApplicant)
  - Father / Mother / Brother / Sister / Son / Daughter / Guardian / Other

Rules:
- This question never appears again and does not change once set.
- It belongs to the Account → Applicant relationship, not to the applicant's profile.
- It never participates in matching.

## What We Do NOT Collect During Registration
- Photos
- Verification documents
- Any profile group beyond Basic Information
- Preferences, religion, or lifestyle details

These are collected later through progressive onboarding and encouragement, never as registration blockers.

## Validation Rules
- Display name: 2–50 characters, no contact details, must pass Content Moderation.
- Date of birth: must confirm age in range 18–78 (step 1).
- Country: from master data (Country Code), never free text.
- Phone: valid per country, normalized to E.164.
- Duplicate account detection: phone and email must be unique and checked for existing verified accounts.

## Principles
1. Do not request dozens of fields during registration.
2. Redirect immediately to onboarding.
3. Encourage profile completion through reminders and benefits.
4. Every completed section improves recommendations.
5. Registration adapts to the user's context while collecting only the minimum information required to create a valid applicant profile.

## Onboarding
Suggested order:
1. Welcome
2. Basic information
3. Photo
4. Verification (optional but encouraged)
5. Continue later option

When the applicant is not the account owner, the onboarding adapts automatically:
- Every field refers to the Applicant, never the Account Owner.
- Photo upload is the applicant's photo; personal details and partner preferences belong to the applicant.
- Labels make this explicit (see Wasla_02 UX Rules) to prevent entering the account owner's information by mistake.

## Profile Completion
Display a completion percentage and unlock better recommendations as users complete sections.

## Golden Rules
- Registration stays as short as its method allows.
- Never block registration on optional verification, a photo, or any non-essential field.
- Every registered user immediately follows the onboarding flow.
- A phone number is the account key; email is optional unless it is the chosen method.

## Cross-References
- Product Principles → [Wasla_02](Wasla_02_Product_Principles.md)
- Profile Groups → [Wasla_04](Wasla_04_Profile_Groups.md)
- Content Moderation → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
- Profile Fields → [Wasla_05](Wasla_05_Profile_Fields.md)
- Data Model → [Wasla_07](Wasla_07_Data_Model.md)
- Rule Engine → [Wasla_11](Wasla_11_Rule_Engine.md)
- Verification & Trust → [Wasla_14](Wasla_14_Trust_Engine.md)

## Login Requirements

### Supported Methods (priority order)
1. Google (OAuth, keys from 066.city shared provider)
2. Facebook (OAuth, keys from 066.city shared provider)
3. Phone Number (OTP)
4. Email

The UI presents methods in this order: Google, Facebook, Phone (OTP), then Email.

### Phone (OTP) Login
- Phone is the account key: every login via phone uses an OTP; no password exists for phone-based accounts.
- OTP validity: 5 minutes.
- Resend limit: configurable (e.g., 3 resends per 10 minutes).
- Rate limiting per phone and IP.

### Email Login
- Email accounts use a password.
- Password reset is available via email link.
- If the user has no password (created via phone), email is added later with verification.

### Passwordless Alternatives (Email)
- Magic link login is optional and future.
- Never auto-convert to a password without user action.

### Sessions & Devices
- Multiple concurrent sessions are allowed.
- The user can view active devices and sign out remotely.
- "Remember this device" is optional; sensitive actions (payment, phone change) always require re-authentication.
- A security notification is sent on login from a new device.

### Method Switching (Account Linking)
- Linking (phone + email + social) is allowed after verification, never during registration.
- Every linking action requires verification of the added method.

### Security (Login)
- Lockout after 5 failed attempts (temporary, configurable).
- OTP: single-use, time-limited, resend-limited.
- Fraud detection on login (new device, new location, anomalous behavior).
- Duplicate account checks at login (find existing account and ask to verify, never auto-merge).
- Duplicate applicant detection (future) and basic fraud detection for profiles created on behalf of relatives (guardian flows).

### Events (Login)
- UserLoggedIn published on every successful sign-in (Wasla_10).
- Login failures are logged for fraud detection without a full event per attempt.

## Golden Rules
- The phone is the account key; social providers are fast paths, never the source of truth.
- No password for phone-based accounts — OTP only.
- Login is never blocked by optional profile completion.

## Event Integration
- UserRegistered → published on successful registration.
- UserLoggedIn → published on each sign-in.
- Event schema follows [Wasla_10](Wasla_10_Event_Engine.md).

## Future
- Apple Sign In
- Passkeys
- Magic link login
- Government ID verification
