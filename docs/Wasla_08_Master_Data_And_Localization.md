# Wasla 08 - Master Data & Localization

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
Define all reference data (Master Data) and the localization strategy used throughout Wasla.

## Principles
- No hardcoded lists.
- Every selectable value comes from master data.
- Business logic uses immutable Codes, never translated names.
- Translation is independent from business data.
- No new master list is added without a clear business purpose (matching, search, or trust).
- Arabic and English are mandatory from day one; other languages are additive.

## Master Data Domains
- Countries
- Cities
- Nationalities
- Religions
- Sects
- Languages
- Professions
- Education Levels
- Marital Status
- Body Types
- Skin Tones
- Eye Colors
- Hair Colors
- Hair Types
- Clothing Styles
- Hobbies
- Sports (optional)

## Standard Structure
Every master table should contain:
- Id
- Code
- SortOrder
- IsActive
- Parent (optional — for hierarchical values)
- Version
- Localizable (yes/no)
- System Defined / Admin Defined
- CreatedAt
- UpdatedAt

## Hierarchical Data
Hierarchies are supported in data, never hardcoded:
- Country → State → City → District
- Occupation → IT → Software Engineer / DevOps / QA Engineer

## Dynamic Dependencies
Master lists may depend on each other; the dependencies are consumed by the Rule Engine and Dynamic Field Rules:
- Country → Cities
- Religion → Sects / Denominations
- Education Level → Available Degrees
- City → Neighborhoods

## Configuration vs Master Data
These are different concepts:
- **Master Data** (controlled business values): Countries, Occupations, Hair Colors.
- **Configuration** (behavioral parameters): Maximum Photos, Daily Likes, Match Threshold, Feature Flags.
- Both are configurable, but they are never mixed.

## Translation Pattern
Do not store multilingual names in master tables.

Example:
Country
- Id
- Code
- ISO2
- ISO3

CountryTranslation
- CountryId
- LanguageId
- Name

The same pattern applies to all master data.

## User Language
A user's interface language is independent from:
- Country
- Nationality
- Residence

## Business Rules
Always compare by Code.
Example:
Religion.Code == ISLAM

Never compare translated text.

## Sensitive Master Data: Religion & Sect

- Religion and Sect are sensitive fields.
- Whether they are required or optional is a product decision per market and is configured, never hardcoded.
- Visibility of religious information is user-controlled, like any other profile field.
- Business logic never infers religion from name, nationality, or language.
- Country-specific rules (e.g., a market where religion is mandatory) are configurable and documented, not silent.

## Change Control

Every master data change is:
- Logged with who made it and when.
- Versioned.
- Reversible.
- Reflected in the audit trail, without requiring a code deployment.

## Admin Requirements
Administrators must be able to:
- Activate/deactivate values
- Change display order
- Add translations
- Manage localized labels
- Add / disable / reorder / archive values
without code deployment.

System values may be disabled or archived but never physically deleted.

## Versioning & Deprecation
Master data evolves. Each dataset supports:
- Effective Date
- Version
- Deprecation
- Replacement

Historical values are preserved even after they become inactive — profiles keep working without breaking.

## Future Ready
Supports:
- Unlimited languages
- Regional customization
- AI localization
- Country-specific business rules

## Cross-References
- Profile groups → [Wasla_04](Wasla_04_Profile_Groups.md)
- Profile fields → [Wasla_05](Wasla_05_Profile_Fields.md)
- Data model → [Wasla_07](Wasla_07_Data_Model.md)
