# Project Maker repository guidance

## Current architecture

- `apps/web`: Angular 22.1 standalone client with PrimeNG 22.0.0.
- `apps/api`: NestJS 11 API with TypeORM and PostgreSQL access.
- `packages/contracts`: shared TypeScript contracts and canonical playbook data.
- Compose runs Nginx, the API, and PostgreSQL on separated edge and internal networks.
- Only Nginx publishes a host port.

## Source map

- Angular routes and pages: `apps/web/src/app/`
- API modules and migrations: `apps/api/src/`
- Shared contracts: `packages/contracts/`
- Runtime and operator handoff: `docs/operations-handoff.md`
- Product/domain model: `docs/product-domain.md`

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
pnpm compose:config
pnpm compose:up
pnpm compose:down
```

Use the exact package-manager and Node versions declared in the root
`package.json`. Keep the lockfile synchronized with both workspace manifests
and Docker build inputs.

## Change boundaries

- Keep the Angular, API, and contract boundaries explicit.
- Treat contract and migration changes as compatibility-sensitive.
- Keep API and PostgreSQL internal to Compose; expose only the web gateway.
- Keep authentication, authorization, and production deployment controls out of
  the foundation until they are separately designed and verified.
- Never commit `.env`, credentials, or database dumps. Keep the application
  license configuration intentional and out of documentation and logs.
- Run focused checks first, then the full relevant gate before completion.

## Documentation

Engineering and operational documentation is English. End-user product copy
may be Hungarian. Keep documentation current and describe only the approved
platform, verified behavior, and active delivery boundaries.
