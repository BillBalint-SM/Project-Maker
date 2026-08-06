# Project state

**Current baseline:** Angular 22.1 web platform with licensed PrimeNG 22.0.0 on `main`.

## Current implementation

- Monorepo: pnpm workspace.
- Web: Angular 22.1 standalone application with PrimeNG 22.0.0.
- API: NestJS with a health endpoint, CORS validation, TypeORM migrations, and PostgreSQL access.
- Shared package: `@project-maker/contracts`.
- Runtime topology: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Product/domain source of truth: `docs/product-domain.md` and `packages/contracts`.

## Current delivery state

The runnable foundation, package gates, database migrations, Compose health
checks, and web/API smoke paths are implemented and verified. Full product
workflows, authentication, authorization, backup operations, and complete
export coverage remain separate delivery work until their requirements and
verification evidence are complete.

## Next gate

Before any repository decision or edit, refresh `WORK_STATE`; do not infer
current branch, HEAD, worktree, upstream, or PR state from this document.
