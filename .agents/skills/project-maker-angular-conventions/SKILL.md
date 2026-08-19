---
name: project-maker-angular-conventions
description: Implement or review Angular code in Project Maker under apps/web, including pages, components, routes, forms, HTTP services, PrimeNG UI, and frontend tests. Apply these repository choices over generic Angular defaults; do not use for NestJS API-only or contract-only work.
---

# Project Maker Angular conventions

Apply these local decisions over general Angular guidance. Inspect the nearby
feature before changing its pattern, and keep incidental modernization out of
an otherwise focused change.

## Boundaries and layout

- Keep routed pages and their UI inside feature folders under
  `apps/web/src/app`. Name routed screens `*.page.ts` and backend adapters
  `*-api.service.ts`.
- Put shared wire types and canonical playbook data in
  `@project-maker/contracts`; keep browser-only view state in the web app.
- Route HTTP through feature API services rather than calling `HttpClient`
  directly from components.

## Components and templates

- Use Angular 22 standalone components. Omit `standalone: true` in new
  decorators because it is the default; preserve it when removing it would be
  unrelated churn.
- Inject dependencies with `inject()`. Use signal inputs such as
  `input.required<T>()` for component inputs.
- Use `@if`, `@for`, and `@switch`. Give `@for` a stable domain identifier when
  one exists.
- Treat `OnPush` adoption as a deliberate feature change with behavioral
  verification, not a drive-by component edit.

## State, forms, and streams

- Use signals for synchronous view state and `computed()` for derived state.
- Existing features use Reactive Forms. Preserve their form strategy during
  maintenance and feature extensions; introduce Signal Forms only through an
  explicit project decision or a separately scoped migration.
- Direct subscriptions are acceptable for one-shot commands and HTTP results
  when the component owns loading, success, and safe error state. Protect
  longer-lived streams with `takeUntilDestroyed()`.
- Preserve the newest user intent when asynchronous saves overlap; tests must
  cover stale responses, retryable failures, and pending work where the
  feature supports autosave or concurrent commands.

## Routing and UI

- Lazy-load routed pages with `loadComponent` unless the page is intentionally
  part of the application shell.
- Import PrimeNG modules at the consuming standalone component. Keep global
  PrimeNG configuration and the theme preset in `app.config.ts` and
  `app.theme.ts`.
- Keep application license handling intentional and out of documentation,
  diagnostics, and generated output.
- Write engineering artifacts in English and user-facing product copy in
  Hungarian. Map internal failures to safe, actionable Hungarian messages.

## Tests and bundle discipline

- Keep Vitest unit/component specs next to the source as `*.spec.ts`. Assert
  observable behavior and state transitions rather than implementation detail.
- Put browser workflows in `apps/web/e2e` and use Playwright when behavior
  crosses routing, the API boundary, persistence, or reloads.
- Run focused checks first, then the relevant web typecheck, tests, and
  production build.
- Preserve lazy boundaries and the production budgets in `angular.json`. For
  dependency, theme, or bootstrap changes near a budget, inspect an Angular
  production `--stats-json` build instead of raising the threshold by default.
