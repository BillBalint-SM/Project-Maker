# Project state

## Current baseline

- Monorepo: pnpm workspace with Angular web, NestJS API, shared contracts, and
  PostgreSQL migrations.
- Runtime: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Domain and delivery status: [product domain](../docs/product-domain.md) and
  [roadmap](../docs/roadmap.md) are the current sources of truth.
- Project preparation supports lifecycle management, Initial Intake, discovery
  follow-ups, contacts, independent discovery rounds, Evidence/Insights,
  governed attachments, readiness, Decision Review, formal decisions, status
  updates, Portfolio/Roadmap, customer handoffs, Customer response requests,
  notifications, correspondence, and versioned project specifications.
- Outputs and delivery support editable Specification-bound Delivery packages,
  Markdown/CSV/print-PDF exports, shared Git setups, preview-confirmed Git
  handoff, and the actor-bound Claude Code MCP connection.
- Customer correspondence (`COMM-01.1`) uses the Operator organization's dedicated TLS
  SMTP/IMAP gateway. Configuration is fail-closed for mail only; unrelated
  workflows remain available when the gateway is incomplete. Gateway activation
  requires the controlled smoke evidence described in
  [mail-gateway.md](../docs/mail-gateway.md).
- Database migration `0032` is the current schema baseline. Historical
  migrations remain retained and must not be edited or removed.
- IMAP checkpoint state is a strict plain versioned value; it has no separate
  secret. Invalid or old checkpoints safely establish a new baseline.

## Verification

Run the repository's targeted typecheck, test, build, Compose, and verifier
commands for the changed scope. The controlled gateway smoke is an operational
activation gate, not a substitute for local automated verification.

## Scope boundaries

- Project Maker does not host a model or use a provider API. Internal users can
  connect their own Claude Code subscription through the actor-bound MCP
  endpoint; imports and offline support remain separate opportunities.
- Customer mail is separate from internal Markdown or Claude Code handoffs.
- Project Customers do not own or configure Operator infrastructure.
