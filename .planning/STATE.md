# Project state

**Verified delivery baseline:** Angular 22.1 web platform with licensed PrimeNG
22.0.0 at merged `main` commit `b4d4c9b`, including guided `INITIAL_INTAKE`
and guarded strict project deletion.

## Current implementation

- Monorepo: pnpm workspace.
- Web: Angular 22.1 standalone application with PrimeNG 22.0.0.
- API: NestJS with a health endpoint, CORS validation, TypeORM migrations, and PostgreSQL access.
- Shared package: `@project-maker/contracts`.
- Runtime topology: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Product/domain source of truth: `docs/product-domain.md` and `packages/contracts`.
- Project lifecycle: create, list, workspace edit, archive, restore, and guarded
  permanent deletion. Only a bare `DRAFT` can be deleted; retained activity
  returns a generic `409` and the project must be archived instead.
- Follow-up read boundary: a first `GET /projects/:projectId/follow-up` returns
  unsaved defaults without creating a persistence row; the first explicit
  `PATCH` creates the row.
- Guided intake: a published project question schema can start one open
  `INITIAL_INTAKE` round, recover that active round, persist answers, complete
  after server validation, and keep completed rounds immutable.
- Persistence boundary: migration `InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000`
  enforces at most one open initial-intake round per project and fails fast on
  pre-existing duplicate open initial rounds.
- Markdown/audit: manual and milestone-triggered Markdown revisions are stored,
  downloadable, and accompanied by bounded cockpit audit history.
- Customer communication: manual customer review and configurable follow-up ping
  delivery exist; they are not `INTAKE-04` operational follow-up management.
- Web intake UX: the interview page resumes the server active round, autosaves
  text answers after 750 ms, saves discrete values immediately, keeps failed
  drafts visible with retry, and renders deterministic Hungarian coaching from
  persisted question metadata.

## Current delivery state

The delivered feature status and scope boundaries are maintained in
[`docs/roadmap.md`](../docs/roadmap.md). The verification surface includes
contracts/API/web typechecks, API and web tests, browser E2E, production build,
repository `verify`, Compose health and migration status, and active-round
recovery after an API restart. Aggregate suite counts belong here only when a
matching receipt is tracked at the baseline or freshly rerun.

The [guided-intake plan](../docs/superpowers/plans/2026-08-06-guided-intake-persistence.md)
and [strict-deletion plan](../docs/superpowers/plans/2026-08-07-strict-project-deletion.md)
preserve their approved pre-execution task lists; their delivery-status notices
and the roadmap explain what is actually shipped.

The verified guided-intake scope is intentionally limited to `INITIAL_INTAKE`.
Operational follow-up management, scoring/readiness calculations, canonical
structured output, authentication, authorization, backup operations, and export
coverage remain separate delivery work until their requirements and verification
evidence are complete.

## Next gate

Before any repository decision or edit, refresh `WORK_STATE`; do not infer
current branch, HEAD, worktree, upstream, or PR state from this document.
