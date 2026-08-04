# Wasla 11 - Rule Engine

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose
The Rule Engine centralizes configurable business rules and removes hardcoded conditional logic from the application.

## Goals
- Configuration over code
- Dynamic behavior
- Reusable rules
- Admin-managed business logic
- Consistent validation

## Relationship to Wasla_06 (Dynamic Fields)

Wasla_06 and Wasla_11 are not two rule engines — they are **two scopes of the same engine**:

- **Wasla_06** evaluates **field-level rules during onboarding**: visibility, required, validation, and dynamic field behavior (when a field shows, whether it is required, what values are valid).
- **Wasla_11** evaluates **all other rules** (matching, search, recommendation, moderation, enforcement) and governs every non-field rule.

A field rule (06) is a Wasla_11 rule whose action belongs to the field action set (show/hide/require/validate) and whose scope is the profile form. Wasla_11 rules may also reference field rules as inputs (e.g., "only recommend when a required Tier-1 rule is satisfied"). Both are authored, versioned, and governed in the same Rule Engine; 06 defines the field-specific actions, 11 everything else.

## Action Types (F3)

Every rule ends in one or more **Actions**. The engine executes all matched actions, in rule priority order:

| Action | Scope | Description |
|---|---|---|
| ShowField | Field (06) | Make a field visible in onboarding |
| HideField | Field (06) | Keep a field hidden |
| RequireField | Field (06) | Mark a field required |
| ValidateField | Field (06) | Run a validation calculator on the value |
| PublishProfile | Profile | Allow the profile to be published/visible |
| SuppressProfile | Profile | Withhold the profile from discovery |
| AllowAction | Feature | Permit an action (message, search, contact share) |
| DenyAction | Feature | Reject an action with the User-Facing Message |
| QueueForReview | Moderation | Route content to the moderation queue (Wasla_15) |
| ApplyRestriction | Enforcement | Apply a restriction (per Wasla_25 permission scope) |
| EmitEvent | System | Publish an event to the Event Engine (Wasla_10) |
| RecomputeScore | Formula | Mark scores stale for the Formula Engine (Wasla_28) |

Execution scope: an action runs **within the engine that owns its scope** (06 for field actions, matching for profile actions, etc.), never inside the controller. Action execution is logged with the rule and its version.

## Block Enforcement Layer (F4)

**Block is an engine-level guarantee, not a toggleable rule.** The Matching, Messaging, Search, and Recommendation engines enforce a blocked relationship as a hard exclusion before any rule runs (Wasla_27). No rule, priority, or configuration can override or weaken a block.

Rules may **add** consequences on top of a block (e.g., a repeated-block rule may lower trust), but they can never remove, lift, or bypass the block itself. Lifting a block is a user action (Wasla_27), never a rule.

## Rule Sources

Rules may depend on:

- Applicant data
- Account type (self / relative)
- Country / Religion / Gender
- Subscription
- Verification status
- Trust level
- Feature Flag
- Admin configuration
- Workflow state

Everything is available as a rule input.

## Formula Engine Integration

The Rule Engine decides **when** a calculation runs; the Formula Engine decides **how** the value is calculated (match score, trust score, completion, ranking inputs). These are separate responsibilities — the Rule Engine never performs math, and the Formula Engine never makes decisions.

## Configuration Center Integration

Constants (minimum match score, maximum photos, OTP expiry, maximum bio length) come from the Configuration Center, never from inside rules. The Rule Engine consumes configuration instead of embedding values.

## Rule Categories
- Visibility Rules
- Validation Rules
- Required Rules
- Matching Rules
- Search Rules
- Recommendation Rules
- Moderation Rules

## Rule Structure
Each rule includes:
- RuleId
- Name
- Description
- Priority
- Enabled
- Conditions
- Operator Groups (AND/OR)
- Actions
- Effective Date
- Expiration Date (optional)
- Owner
- Reason (why the rule exists)
- Version
- User-Facing Message (what the user is told when this rule affects them)
- Sensitive Flag (whether the rule touches privacy or enforcement)

## Supported Operators
- Equals
- Not Equals
- Greater Than
- Less Than
- Between
- In List
- Contains
- Exists
- Is Empty
- Is Not Empty

## Example Rules
- Show "Divorce Year" only when Marital Status = Divorced.
- Show "Current Wives" only for Muslim married males.
- Require "Accept My Children" when HasChildren = True.

## Execution Principles
- Evaluate rules deterministically.
- Respect priority.
- Allow multiple actions.
- Log execution results.
- Rule conflicts are resolved by priority; equal-priority conflicts resolve by a fixed, documented order (e.g., RuleId), never arbitrarily.

## Rule Safety (Mandatory)
- Rules can never make a protected field required, matchable, or visible to others.
- Rules cannot weaken a user's privacy choice.
- Sensitive domains (Health) are excluded from rule-driven exposure by definition.
- Any rule that affects privacy or enforcement carries a Sensitive Flag and requires elevated approval.

## Rule Governance
- Creating or editing a Sensitive rule requires a second review, not a single admin action.
- Every rule change is versioned, logged with owner and reason, and reversible.
- Rules are tested against sample profiles before activation; results are shown to the approver.
- Only authorized roles can create or change rules; roles vary by rule category.

## Integration
Works with:
- Workflow Engine
- Event Engine
- Matching Engine
- Recommendation Engine
- Admin Panel

## Admin Requirements
Administrators can:
- Create rules
- Enable/disable rules
- Change priorities
- Test rules (against sample profiles, with a visible result)
- View execution history

## Best Practices
- Keep rules atomic.
- Avoid duplicated conditions.
- Version important rules.
- Never embed business rules in UI code.

## Golden Rule
Business policy belongs in the Rule Engine, not in application code.

Second rule: the Rule Engine never overrides a user's privacy choice, and sensitive rules require review before they take effect.

## Cross-References
- Dynamic fields → [Wasla_06](Wasla_06_Dynamic_Fields_And_Rule_Engine.md)
- Workflow → [Wasla_09](Wasla_09_Workflow_Engine.md)
- Events → [Wasla_10](Wasla_10_Event_Engine.md)
- Content Moderation rules → [Wasla_15](Wasla_15_Content_Moderation_Engine.md)
