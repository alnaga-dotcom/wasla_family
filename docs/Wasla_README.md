# Wasla (وصلة) – Documentation Index

Wasla is an intelligent matchmaking platform that helps people find compatible life partners.

This is the official Software Architecture Specification. Every file shares the same structure, terminology and architectural style.

## Document Map

| # | File | Status |
|---|------|--------|
| 01 | [Wasla_01_Philosophy.md](Wasla_01_Philosophy.md) | ✅ Done |
| 02 | [Wasla_02_Product_Principles.md](Wasla_02_Product_Principles.md) | ✅ Done |
| 03 | [Wasla_03_Registration.md](Wasla_03_Registration.md) | ✅ Done |
| 04 | [Wasla_04_Profile_Groups.md](Wasla_04_Profile_Groups.md) | ✅ Done |
| 05 | [Wasla_05_Profile_Fields.md](Wasla_05_Profile_Fields.md) | ✅ Done |
| 06 | [Wasla_06_Dynamic_Fields_And_Rule_Engine.md](Wasla_06_Dynamic_Fields_And_Rule_Engine.md) | ✅ Done |
| 07 | [Wasla_07_Data_Model.md](Wasla_07_Data_Model.md) | ✅ Done |
| 08 | [Wasla_08_Master_Data_And_Localization.md](Wasla_08_Master_Data_And_Localization.md) | ✅ Done |
| 09 | [Wasla_09_Workflow_Engine.md](Wasla_09_Workflow_Engine.md) | ✅ Done |
| 10 | [Wasla_10_Event_Engine.md](Wasla_10_Event_Engine.md) | ✅ Done |
| 11 | [Wasla_11_Rule_Engine.md](Wasla_11_Rule_Engine.md) | ✅ Done |
| 12 | [Wasla_12_Matching_Engine.md](Wasla_12_Matching_Engine.md) | ✅ Done |
| 13 | [Wasla_13_Recommendation_Engine.md](Wasla_13_Recommendation_Engine.md) | ✅ Done |
| 14 | [Wasla_14_Trust_Engine.md](Wasla_14_Trust_Engine.md) | ✅ Done |
| 15 | [Wasla_15_Content_Moderation_Engine.md](Wasla_15_Content_Moderation_Engine.md) | ✅ Done |
| 16 | [Wasla_16_Notification_Engine.md](Wasla_16_Notification_Engine.md) | ✅ Done |
| 17 | [Wasla_17_Subscription_System.md](Wasla_17_Subscription_System.md) | ✅ Done |
| 18 | [Wasla_18_Messaging.md](Wasla_18_Messaging.md) | ✅ Done |
| 19 | [Wasla_19_Search.md](Wasla_19_Search.md) | ✅ Done |
| 20 | [Wasla_20_Admin_Panel.md](Wasla_20_Admin_Panel.md) | ✅ Done |
| 21 | [Wasla_21_API_Design.md](Wasla_21_API_Design.md) | ✅ Done |
| 22 | [Wasla_22_Security.md](Wasla_22_Security.md) | ✅ Done |
| 23 | [Wasla_23_Deployment.md](Wasla_23_Deployment.md) | ✅ Done |
| 24 | [Wasla_24_Website_Design.md](Wasla_24_Website_Design.md) | ✅ Done |
| 25 | [Wasla_25_Roles_And_Permissions.md](Wasla_25_Roles_And_Permissions.md) | ✅ Done |
| 26 | [Wasla_26_Design_Review.md](Wasla_26_Design_Review.md) | ✅ Done |
| 27 | [Wasla_27_Match_Workflow.md](Wasla_27_Match_Workflow.md) | ✅ Done |
| 28 | [Wasla_28_Formula_Engine.md](Wasla_28_Formula_Engine.md) | ✅ Done |
| 29 | [Wasla_29_API_Endpoints.md](Wasla_29_API_Endpoints.md) | ✅ Done |

## Architecture

Wasla is a modular engine-based architecture. A thin gateway (API, Wasla_21) fronts independent engines, each owning its concern:

- **Identity**: Registration (03), Profile Groups (04), Fields (05), Master Data (08)
- **Behavior**: Workflow (09), Events (10), Rules (06/11), Formula (28)
- **Matching**: Matching (12), Recommendation (13), Match Workflow (27), Search (19)
- **Trust & Safety**: Trust (14), Moderation (15), Security (22)
- **Experience**: Messaging (18), Notifications (16), Subscription (17), Website (24)
- **Operations**: Admin (20), Roles (25), API (21), Deployment (23)

Deployment (Wasla_23) maps services one-to-one to these engines.

## Design & Framework

The website design specification lives in [Wasla_24](Wasla_24_Website_Design.md). The consolidated review of all documents lives in [Wasla_26](Wasla_26_Design_Review.md).

## Related Frameworks

- Field Definition Framework → refines Wasla_05_Profile_Fields
- Website Design Specifications → derived from the reviewed docs

## Workflow

- Documents are reviewed one file at a time.
- Each update keeps the same structure, terminology and architectural style.
- Completed docs enable backend code, database schemas, APIs, frontend forms and onboarding.
