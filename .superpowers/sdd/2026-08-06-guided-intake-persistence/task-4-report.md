# Task 4 report

## Implementation summary

- Replaced the normal-flow per-question manual save with safe autosave on the guided interview page.
- Added explicit per-question autosave state (`idle`, `saving`, `saved`, `error`), per-question timers, and question-level retry actions.
- Applied the required `750 ms` debounce to `TEXT` and `LONG_TEXT` answers.
- Persisted discrete answers and explicit clear actions immediately.
- Kept newer drafts visible when older requests settled later, and immediately persisted the newer value when needed.
- Preserved Task 3's active-round resume banner, server-driven resume behavior, and branded safe load-error boundary.
- Reworked question coaching into one deterministic Hungarian rendering path driven only by snapshot contract fields (`controlPoint`, `required`, `blocking`, `hint`, `type`, `options`).
- Kept API endpoints and shared contracts unchanged.

## Files changed

- `apps/web/src/app/interviews/interview.page.ts`
- `apps/web/src/app/interviews/interview.page.html`
- `apps/web/src/app/interviews/interview.page.scss`
- `apps/web/src/app/interviews/interview.page.spec.ts`

Not changed:

- `apps/api/test/question-rounds.e2e-spec.ts` (no API-level save-failure fixture was needed for this slice)

## TDD RED/GREEN evidence

### RED

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
```

Observed failure before implementation:

```text
❯ |web| src/app/interviews/interview.page.spec.ts (10 tests | 5 failed) 373ms
  × autosaves text answers after exactly 750 ms and removes the normal manual save control
  × persists discrete boolean answers immediately
  × keeps the newer text draft visible when an older autosave settles and immediately persists the newer value
  × keeps the failed draft visible, shows a Hungarian retry action, and retries the same value
  × renders deterministic Hungarian coaching from the round snapshot contract
```

Representative failure details:

```text
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
AssertionError: expected null not to be null
AssertionError: expected ... to contain 'Ellenőrzési pont: Üzleti cél'
```

### GREEN

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
```

Observed result after implementation:

```text
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  4.13s
```

## Full-suite command/output

### Web unit suite

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web test
```

Output:

```text
Test Files  2 passed (2)
     Tests  11 passed (11)
  Duration  4.25s
```

### Web typecheck

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web typecheck
```

Output:

```text
$ tsc --project tsconfig.app.json --noEmit
exit 0
```

## Self-review

- Verified that ordinary answer persistence no longer depends on the manual save button; retry is error-only.
- Verified the required `750 ms` debounce with focused unit coverage.
- Verified immediate persistence for discrete answer types with focused unit coverage.
- Verified stale-response safety: newer drafts stay visible and are re-persisted deterministically.
- Verified Hungarian load, save, retry, schema, round-status, and coaching copy on the page.
- Verified that no browser storage, offline queue, API contract, or shared contract changes were introduced.
- Kept the diff scoped to the interview page and its focused unit coverage.

## Concerns

- The shell PATH pnpm was `11.16.0`, so verification used `npx pnpm@11.20.0 ...` to match the repository's required pnpm version without changing the repo or global toolchain.
- The branch did not need an API e2e save-failure fixture for this slice because the failure and retry behavior was fully covered at the web unit level.

---

## Fix round 1

### Implementation summary

- Prevented round completion while any question is still in autosave `error` state, even when there are no pending timers or in-flight requests left.
- Added a clear Hungarian blocked-state message for this case and kept the retryable draft visible.
- Preserved normal completion once all answer saves are no longer in error and server-side completion validation passes.
- Mapped project schema publish/update failures on the interview page to safe Hungarian user-facing text without exposing raw English/database details from the service layer.

### TDD RED

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
```

Observed failure before the fix:

```text
❯ |web| src/app/interviews/interview.page.spec.ts (12 tests | 2 failed) 3736ms
  × blocks completion while a failed autosave is still in error and keeps the retryable draft visible
  × maps schema publish failures to safe Hungarian text without exposing the raw service message
```

Representative failure details:

```text
AssertionError: expected false to be true
AssertionError: expected 'Could not update the project question...' to be 'Nem sikerült frissíteni a projektsémát...'
```

### TDD GREEN

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
```

Observed result after the fix:

```text
Test Files  1 passed (1)
     Tests  12 passed (12)
  Duration  5.31s
```

### Fresh full-suite verification

#### Web unit suite

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web test
```

Output:

```text
Test Files  2 passed (2)
     Tests  13 passed (13)
  Duration  5.15s
```

#### Web typecheck

Command:

```text
npx pnpm@11.20.0 --filter @project-maker/web typecheck
```

Output:

```text
$ tsc --project tsconfig.app.json --noEmit
exit 0
```

### Self-review

- The completion guard now blocks both the actual button path and a direct method call while any answer save remains failed.
- The new blocked message is Hungarian, actionable, and scoped to the answer-save error state.
- The schema publish failure mapping is contained to the interview page and does not refactor unrelated services.
- Successful schema publish/update behavior remains unchanged.
