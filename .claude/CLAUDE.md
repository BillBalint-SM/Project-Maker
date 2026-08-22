# Project Maker repository guidance

## Current architecture

- `apps/web`: Angular 22.1 standalone client with PrimeNG 22.0.0.
- `apps/api`: NestJS 11 API with TypeORM and PostgreSQL.
- `packages/contracts`: shared TypeScript contracts and canonical versioned playbook data.
- Nginx is the only Compose service that publishes a host port; the API and PostgreSQL stay internal.
- The supported migration sequence is `0001 -> 0036`.

## Product and access model

Project Maker is a VPN-restricted internal product-discovery and project-preparation application. Internal users authenticate with self-managed local email-and-password accounts and share one capability level. Do not introduce roles, memberships, administrators, or per-Project permissions without an explicit product decision. Public Customer response links and actor-bound MCP tokens are narrow boundaries, not alternate general accounts.

## Source map

- Angular routes, pages, and frontend tests: `apps/web/`
- API modules, migrations, and API tests: `apps/api/`
- Shared contracts and playbooks: `packages/contracts/`
- Product vocabulary and behavior: `docs/product-domain.md` and `CONTEXT.md`
- Environment configuration: `docs/configuration.md`
- Runtime and Operator handoff: `docs/operations-handoff.md`
- Delivered and remaining capability: `docs/roadmap.md`

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
pnpm test:mail-gateway
pnpm compose:config
pnpm compose:up
pnpm compose:down
```

Use the Node and pnpm versions declared in the root `package.json`. Keep the lockfile synchronized with workspace manifests and Docker build inputs.

## Change boundaries

- Keep Angular, API, and contracts responsibilities explicit.
- Treat contract and forward-only migration changes as compatibility-sensitive.
- Preserve the VPN plus local-identity model and the shared Internal-user capability level.
- Keep Customer mail, Git handoff, MCP, attachments, and general Project work as bounded modules.
- Never commit `.env`, credentials, tokens, Customer data, attachment bytes, or database dumps.
- Keep application license registration intentional and out of documentation, diagnostics, and generated output.
- Use professional software-development and project-management English for engineering artifacts and product copy. Preserve user-authored content and legacy wire/storage values; translate legacy values at presentation boundaries.
- Keep validation proportional to the change. Verify directly affected behavior and the most significant risks.

## Documentation

Update documentation in the same change as behavior or configuration. `docs/roadmap.md` is the delivery-status source, `docs/user-guide.md` is the current user workflow manual, and ADRs preserve architectural decision history rather than current delivery status.
