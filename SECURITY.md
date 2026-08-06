# Security Policy

## Supported versions

The web platform is currently a development foundation and has no supported public production release. The historical desktop release is preserved by Git tag `legacy-desktop-v0.1.2` but is no longer maintained on this branch.

## Reporting a vulnerability

Report vulnerabilities privately through a GitHub Security Advisory or directly to the repository owner. Do not publish exploit details until a fix is available.

Include the affected route or component, reproduction steps, expected impact, and the smallest safe diagnostic evidence. Never include real credentials, personal data, access tokens, database contents, or other confidential values.

## Foundation deployment boundary

- Never commit `.env` or real credentials. `.env.example` contains placeholders only.
- Only the Nginx web service publishes a host port in the Compose topology. The API and PostgreSQL remain internal.
- `CORS_ORIGIN` must be set explicitly to the public web origin before the API starts.
- This foundation does not yet implement authentication or authorization and must not be treated as production-ready for user or project data.
