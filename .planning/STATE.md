# Project state

**Current baseline:** Angular 22.1 web platform with licensed PrimeNG 22.0.0 plus the first verified guided `INITIAL_INTAKE` persistence slice on `dev-guided-intake`.

## Current implementation

- Monorepo: pnpm workspace.
- Web: Angular 22.1 standalone application with PrimeNG 22.0.0.
- API: NestJS with a health endpoint, CORS validation, TypeORM migrations, and PostgreSQL access.
- Shared package: `@project-maker/contracts`.
- Runtime topology: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Product/domain source of truth: `docs/product-domain.md` and `packages/contracts`.
- Guided intake: a published project question schema can start one open
  `INITIAL_INTAKE` round, recover that active round, persist answers, complete
  after server validation, and keep completed rounds immutable.
- Persistence boundary: migration `InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000`
  enforces at most one open initial-intake round per project and fails fast on
  pre-existing duplicate open initial rounds.
- Web intake UX: the interview page resumes the server active round, autosaves
  text answers after 750 ms, saves discrete values immediately, keeps failed
  drafts visible with retry, and renders deterministic Hungarian coaching from
  persisted question metadata.

## Current delivery state

The runnable foundation, package gates, database migrations, Compose health
checks, web/API smoke paths, and the first guided `INITIAL_INTAKE` vertical
slice are implemented and verified. The Task 6 gate passed with API/web/contracts
typechecks, API/web unit tests, web E2E, production build, repository `verify`,
Compose health, migration status, and active-round recovery after API restart.
The tracked evidence handoff is
`.superpowers/sdd/2026-08-06-guided-intake-persistence/task-6-report.md`.

The verified guided-intake scope is intentionally limited to `INITIAL_INTAKE`.
Follow-up management, scoring/readiness calculations, structured output
generation, authentication, authorization, backup operations, and complete
export coverage remain separate delivery work until their requirements and
verification evidence are complete.

## Next gate

Before any repository decision or edit, refresh `WORK_STATE`; do not infer
current branch, HEAD, worktree, upstream, or PR state from this document.
