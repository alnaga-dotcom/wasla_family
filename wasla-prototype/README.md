# Wasla (وصلة) — V1 Clickable Prototype

> HTML prototype phase per [Wasla_24](docs/Wasla_24_Website_Design.md) Next Steps.
> Mirrors the flow: Register → Onboarding/Profile → Discovery (swipe) → Match → Messaging,
> per docs 03/04/05/12/27/18. All profiles shown are **Demo accounts** (Wasla_04 §16a) — never real people.

## Run

Serve this folder statically (e.g., `python -m http.server 8081`) and open `http://127.0.0.1:8081`.

## Screens

- **Login / Register** — minimal registration (<60s, Wasla_03), OTP demo step, Arabic digits.
- **Onboarding** — tiered profile groups (Wasla_04/05) with personal completion % checklist (05 §9e), one-nudge-per-session (05 §9c).
- **Discovery** — swipe cards with tap fallback (Wasla_24), match-reason chips (reason safety, Wasla_12), demo labeling (04 §16a).
- **Matches** — mutual matches, archive (Wasla_27).
- **Messaging** — opens only after mutual like (Wasla_18); text + ephemeral photo; block/report.

## Notes

- The prototype demonstrates the happy path with demo data only.
- Visual language: burgundy/gold on cream, Amiri + Inter, RTL, Arabic numerals.
