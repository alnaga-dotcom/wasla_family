# Wasla 23 - Deployment

> Part of the [Wasla Documentation Index](Wasla_README.md)

## Purpose

Defines how Wasla is built, released, operated, and recovered. Deployment is repeatable, auditable, and aligned with the security and modular architecture of the platform.

## Objectives

- Reproducible builds and releases.
- Environments separated (development, staging, production).
- Zero-downtime upgrades where possible.
- Backup and restore with tested recovery.
- Monitoring and observability for engines and security.

## Environments

- Development: local and shared dev, feature flags on.
- Staging: full integration with seeded data, mirrors production config.
- Production: real data; changes require approval and follow release policy.

Promotion is only via the release pipeline. Direct changes to production are prohibited.

## Build & Release

- Containerized services; immutable images tagged with version and commit.
- Secrets injected from a secrets manager at runtime, never baked into images or code.
- Database migrations are versioned, reviewed, and applied as part of the release.
- Releases are reversible: documented rollback for every deploy.

## Architecture & Deployment Topology

- Modular services matching the engines (Wasla_README architecture):
  - API gateway + member API (Wasla_21)
  - Matching, Recommendation, Trust, Moderation, Notification, Event engines
  - Admin Panel (Wasla_20)
  - Databases (relational for transactions, search index for discovery)
  - Background workers for async processing (matches, moderation, notifications, payments)
- Horizontal scaling for stateless services; stateful services scale with care.

## Configuration

- All configuration is externalized and versioned.
- Feature flags managed per environment.
- Rule Engine configuration (Wasla_11) is data, deployed with rules to avoid silent switches.

## Observability

- Centralized logging with PII masking before storage.
- Metrics for engines, queues, and API health.
- Distributed tracing for async flows.
- Alerts for security events, anomalies, and SLAs (Wasla_22).

## Backup & Recovery

- Scheduled backups for transactional data and media.
- Backups encrypted and stored off-site.
- Restore drills performed periodically; recovery time objective defined per tier.
- Deletion requests must also be reflected in backups within policy time.

### Recovery Targets (F21)

- **RPO**: 15 minutes for transactional data (streaming replication/WAL); 24 hours for media.
- **RTO**: 4 hours for core services (API, matching, messaging); 24 hours for full-environment restore.
- Restore drills run at least once per quarter and prove the targets; results are logged.

## Zero-Downtime Strategy (F21)

- API services deploy via rolling/blue-green or canary: new version staged, health-checked, traffic shifted incrementally, rollback on failure.
- Database schema changes are backward compatible (expand → migrate → contract) and applied before the application release that depends on them.
- Workers drain gracefully: stop accepting work, finish in-flight items, then swap (queue-backed handoff).
- Background jobs and event consumers are re-runnable/idempotent (Wasla_10), making deploys safe to retry.
- Web UI (static) and PWA are served from immutable, versioned artifacts; rollout is instant and reversible.

## CI/CD Pipeline (F21)

Stages (blocking on failure):
1. Lint & format
2. Unit tests
3. Integration tests
4. Container/security scan (dependencies, secrets)
5. Build immutable, tagged images
6. Deploy to staging (seeded data, rules validated — Wasla_11)
7. Canary deploy to production
8. Full production deploy + smoke tests

- Git-based triggers; every production change requires an approved release from a protected branch.
- Secrets injected at runtime from the secrets manager; no secrets in the pipeline logs.
- Pipelines and tooling are vendor-agnostic (GitHub Actions / GitLab CI / equivalent).

## Compliance (F21)

- Data protection rights (access, rectification, erasure, portability) honored per Wasla_07 and Wasla_22 data residency.
- Records of processing and consent records are maintained; processors are covered by DPAs.
- Localized legal notices (Arabic first) and regulators' requirements (Egyptian law, GDPR-equivalent where applicable) are tracked as release criteria.

## Deployment of Rules & Weights

- Matching weights (Wasla_12) and business rules (Wasla_11) are deployed as versioned data.
- Sensitive rule changes require staging validation before production (Wasla_11, Wasla_20).

## Security Posture

- Production is hardened: TLS, HSTS, network segmentation, minimal exposure.
- Vulnerability scanning in the pipeline; dependency updates tracked.
- Secrets rotation supported for all services.
- Incident response plan is exercised and documented (Wasla_22).

## Golden Rule

Deployment is an audited, repeatable process. Every production change is traceable, reversible, backed up, and observable — because member trust depends on it.

## Cross-References
- Architecture → [Wasla_README](Wasla_README.md)
- API → [Wasla_21](Wasla_21_API_Design.md)
- Security → [Wasla_22](Wasla_22_Security.md)
- Roles & Permissions → [Wasla_25](Wasla_25_Roles_And_Permissions.md)
- Admin → [Wasla_20](Wasla_20_Admin_Panel.md)
