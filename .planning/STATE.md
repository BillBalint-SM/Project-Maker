# Project state

## Current baseline

- Monorepo: pnpm workspace with Angular web, NestJS API, shared contracts, and
  PostgreSQL migrations.
- Runtime: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Domain and delivery status: [product domain](../docs/product-domain.md) and
  [roadmap](../docs/roadmap.md) are the current sources of truth.
- Project preparation supports lifecycle management, Initial Intake, discovery
  follow-ups, readiness and Decision Review, customer handoffs, customer
  correspondence, and versioned project specifications.
- Customer correspondence (`COMM-01.1`) uses the Operator organization's dedicated TLS
  SMTP/IMAP gateway. Configuration is fail-closed for mail only; unrelated
  workflows remain available when the gateway is incomplete. Gateway activation
  requires the controlled smoke evidence described in
  [mail-gateway.md](../docs/mail-gateway.md).
- Database migration `0024` is the current schema baseline. Historical
  migrations remain retained and must not be edited or removed.

## Verification

Run the repository's targeted typecheck, test, build, Compose, and verifier
commands for the changed scope. The controlled gateway smoke is an operational
activation gate, not a substitute for local automated verification.

## Scope boundaries

- The delivered interview slice is `INITIAL_INTAKE`; additional round types,
  exports, imports, offline support, authentication/authorization, and live AI
  remain separately planned.
- Customer mail is separate from internal Markdown or Claude Code handoffs.
- Project Customers do not own or configure Operator infrastructure.
