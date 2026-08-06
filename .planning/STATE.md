# Project state

**Current baseline:** Web-platform foundation on `dev-web-platform-foundation`.

This file supersedes the July 2026 React/RxDB desktop/PWA execution state. References under `.planning/phases/` and `.planning/codebase/` are retained as historical discovery and implementation evidence only; they do not describe the current source tree or approved stack.

## Current implementation

- Monorepo: pnpm workspace.
- Web: Angular standalone application with PrimeNG.
- API: NestJS with a health endpoint and startup CORS validation.
- Shared package: `@project-maker/contracts`.
- Runtime topology: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Product/domain source of truth: `docs/product-domain.md`.

## Current delivery state

Task 1 establishes the runnable foundation only. The Angular shell, NestJS health API, package gates, and static Compose topology exist. Product workflows, persistence, authentication, migrations, scoring execution, exports, and full PWA behavior are not implemented in this new platform baseline unless separately delivered and verified.

The deleted React, RxDB, IndexedDB, Vite, Tauri, Rust, and desktop-installer files are not current implementation. Their reusable product meaning is preserved in `docs/product-domain.md`; implementation recovery remains possible through the `legacy-desktop-v0.1.2` tag.

## Next gate

Continue from the approved web-platform implementation plan. Before any repository decision or edit, refresh `WORK_STATE`; do not infer current branch, HEAD, worktree, upstream, or PR state from this document.
