# Security policy

## Supported deployment

Project Maker is supported as a private, Operator organization-managed internal application. It is not a public multi-tenant SaaS product. The deployment must remain behind the Operator organization's VPN or an equivalent private network boundary.

## Reporting a vulnerability

Report vulnerabilities privately through a GitHub Security Advisory or directly to the repository owner. Do not publish exploit details before a fix is available.

Include the affected route or component, reproducible steps, expected impact, and the smallest safe diagnostic evidence. Never include credentials, access tokens, Customer data, database contents, attachment bytes, or other confidential values.

## Identity and access boundary

- Internal users sign up, sign in, deactivate, recover, and maintain their own local email-and-password accounts.
- All authenticated Internal users share one application capability level. Project Maker intentionally has no roles, memberships, administrative tier, or per-Project permissions.
- VPN access limits reachability; local sessions identify the actor and bind audit history.
- `/respond` is a separate public capability-link boundary for one narrowly scoped Customer response. A link does not create an account or grant general application access.
- `/mcp` requires a bearer token owned and managed by one Internal user. MCP tools remain bounded to Project Maker workflows and do not expose generic database, filesystem, Customer-mail, or unconfirmed Git-write access.

## Deployment and data boundary

- Never commit `.env`, credentials, tokens, database dumps, attachment contents, or Customer data. `.env.example` contains placeholders only.
- Only Nginx publishes a host port in the Compose topology. The API and PostgreSQL remain on internal networks.
- `CORS_ORIGIN` must be the exact deployed browser origin.
- Shared Git setup credentials are retained for employee convenience and encrypted at rest with the deployment's `GIT_CREDENTIAL_ENCRYPTION_KEY`. Do not print credential values in logs or diagnostics.
- Customer mail and Git handoff are independent modules. Mail configuration fails closed for Customer-mail operations without making unrelated Project workflows unavailable.
- Uploaded files use an explicit type and size allowlist and are returned as authenticated, inert downloads rather than rendered application content.

See [Configuration](docs/configuration.md), [Operations handoff](docs/operations-handoff.md), and [Operator mail gateway](docs/mail-gateway.md) for the current operational controls.
