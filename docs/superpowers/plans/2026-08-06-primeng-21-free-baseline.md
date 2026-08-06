# PrimeNG 21.1.9 Free Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax (- [ ]) for tracking.

**Goal:** Move the web application from the PrimeNG 22 / Angular 22 dependency graph to the PrimeNG 21.1.9 / Angular 21-compatible graph so the deployed UI remains on the MIT-licensed PrimeNG line and no PrimeUI license notice is emitted.

**Architecture:** Only the Angular web workspace is version-aligned. The NestJS API, shared contracts, PostgreSQL schema, SMTP configuration, Compose networks, and generated Markdown behavior remain unchanged. PrimeNG 21.1.9 declares Angular 21 peer ranges, so the plan deliberately downgrades the complete web Angular toolchain instead of suppressing peer-dependency warnings or forcing an unsupported Angular 22 + PrimeNG 21 combination.

**Tech Stack:** Angular 21.2.19, Angular CLI/build 21.2.20, Angular CDK 21.2.14, PrimeNG 21.1.9, @primeuix/themes 2.0.3, TypeScript 5.9.3 for the web workspace, RxJS 7.8.2, zone.js 0.16.2, pnpm 11.9.0, Node 24 Alpine, Nginx Alpine.

## Global Constraints

- Change only the web dependency graph and the documentation that describes it.
- Keep apps/api and packages/contracts on TypeScript 6.0.3; pnpm must retain both web TypeScript 5.9.3 and backend/contracts TypeScript 6.0.3.
- Keep providePrimeNG({ theme: { preset: Aura } }) and the existing application behavior; no UI redesign is part of this slice.
- Do not add a PrimeUI license key, license environment variable, or runtime network call.
- Do not change database migrations, persisted data, SMTP settings, Docker network boundaries, or API contracts.
- Do not add new tests in this slice. Run the existing narrow typecheck/build/Compose smoke gates to prove the downgrade does not break the application.
- Do not commit, merge, or push until the user reviews and explicitly approves the implementation result.

## Current Impact Assessment

The current web manifest pins Angular runtime packages to 22.1.0, Angular CLI/build to 22.1.2, @primeuix/themes to 3.0.0, PrimeNG to 22.0.0, and web TypeScript to 6.0.3. PrimeNG 21.1.9 has peer ranges for Angular 21 (Angular core, common, forms, router, platform-browser, and CDK), so changing only primeng would create an unsupported peer graph.

The application source currently uses providePrimeNG, the Aura preset, standard PrimeNG modules (Button, Card, InputText, Message, ProgressSpinner, Tag, Select, DatePicker, and Textarea), and no v21-incompatible animation options. PrimeNG's v21 migration guide describes v21 as a drop-in update apart from deprecated animation transition options; the repository has no showTransitionOptions or hideTransitionOptions usage. The first Angular 21 build exposed one existing nullable options interpolation in the question bank; Task 3 contains the minimal null-safe template fix required by the stricter compiler.

The Node 24 Alpine build image already satisfies Angular 21's supported Node range. The Dockerfile output path and Nginx runtime are unchanged. The API, contracts, database, and Compose health checks are outside the blast radius.

The licensing decision is supported by PrimeTek's announcement: all existing MIT versions remain MIT permanently, while the new PrimeUI license applies from PrimeNG 22 onward. PrimeNG 21.1.9 is listed by npm as the v21-stable tag.

## Options and Recommendation

| Option | Result | Assessment |
| --- | --- | --- |
| **R — Align Angular 21 + PrimeNG 21.1.9** | Free/MIT PrimeNG line, supported peer graph, no license notice | **Recommended** |
| S — Keep Angular 22 + PrimeNG 22 Community | Retains Angular 22, but requires PrimeUI Community eligibility/registration and annual key renewal | Not aligned with the requested no-license-key baseline |
| U — Keep Angular 22 + PrimeNG 21 with peer overrides | Avoids the v22 notice but violates PrimeNG's declared peers and can fail during install, build, or runtime | Rejected |

The proposed implementation uses Option R. It trades Angular 22 features for a coherent, free web baseline. If “latest Angular” remains a hard requirement, this downgrade should not be implemented; the alternative decision would be PrimeNG 22 under an approved PrimeUI Community or Commercial license.

## File Map

- Modify apps/web/package.json: align Angular, PrimeNG, theme, and web TypeScript versions.
- Modify pnpm-lock.yaml: regenerate the workspace lock graph; remove PrimeNG 22 and the PrimeUI license-manager path from the web graph.
- Modify apps/web/src/app/settings/question-bank.page.html: make the nullable options display safe for the Angular 21 template compiler.
- Modify README.md: describe the Angular 21 / PrimeNG 21.1.9 baseline and the explicit upgrade-review boundary.
- Modify docs/operations-handoff.md: update the runtime matrix from Angular 22 to Angular 21.2 + PrimeNG 21.1.9.
- Inspect only apps/web/src/app/app.config.ts and apps/web/src/app/**/*.html: no source changes are expected after the compatibility gate.
- Inspect only apps/web/Dockerfile and compose.yaml: no container or infrastructure changes are expected.

---

### Task 1: Reconfirm the implementation base before editing

**Files:**
- Read: repository work state and the files listed in the File Map.

**Interfaces:**
- Consumes: current WORK_STATE, current main checkout, and the package metadata recorded above.
- Produces: a clean, verified base for the dependency change; no file modifications.

- [ ] **Step 1: Run the repository state gate**

Run:

~~~
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
~~~

Expected: repository C:/Users/littl/.codex/worktrees/project-maker-web-platform, branch main, clean worktree, and HEAD d579d8f4b13b073009f2afa46822a6ebc208ea9b unless an external change has occurred.

- [ ] **Step 2: Confirm the web-only dependency surface**

Run:

~~~
pnpm view primeng@21.1.9 peerDependencies dependencies --json
pnpm view @angular/build@21.2.20 peerDependencies --json
pnpm view @primeuix/themes@2.0.3 dependencies --json
rg -n --hidden -g '!**/node_modules/**' -g '!**/.git/**' "showTransitionOptions|hideTransitionOptions|provideAnimationsAsync" apps/web
~~~

Expected: PrimeNG 21.1.9 peers target Angular 21; Angular build 21 requires TypeScript below 6; themes 2.0.3 depends on the v21 PrimeUIX styling line; the application has no transition-option usage.

- [ ] **Step 3: Stop on a dirty or conflicting base**

If the state gate reports a dirty worktree, different repository, unknown upstream, or conflicting branch, stop without changing dependency files and report the exact state result. Do not reset or clean the worktree.

---

### Task 2: Align the web dependency manifest and lockfile

**Files:**
- Modify: apps/web/package.json:12-33
- Modify: pnpm-lock.yaml (regenerated by pnpm)

**Interfaces:**
- Consumes: the clean base from Task 1.
- Produces: a frozen web dependency graph with no PrimeNG 22 or PrimeUI license-manager dependency.

- [ ] **Step 1: Replace only the web version pins**

Set the web manifest versions to this exact table:

~~~
{
  "dependencies": {
    "@angular/cdk": "21.2.14",
    "@angular/common": "21.2.19",
    "@angular/core": "21.2.19",
    "@angular/forms": "21.2.19",
    "@angular/platform-browser": "21.2.19",
    "@angular/router": "21.2.19",
    "@primeuix/themes": "2.0.3",
    "primeng": "21.1.9",
    "rxjs": "7.8.2",
    "tslib": "2.8.1",
    "zone.js": "0.16.2"
  },
  "devDependencies": {
    "@angular/build": "21.2.20",
    "@angular/cli": "21.2.20",
    "@angular/compiler": "21.2.19",
    "@angular/compiler-cli": "21.2.19",
    "@playwright/test": "1.62.1",
    "typescript": "5.9.3",
    "vitest": "4.1.9"
  }
}
~~~

Do not change apps/api/package.json, packages/contracts/package.json, root package.json, or the Node/pnpm engine policy.

- [ ] **Step 2: Regenerate the lockfile from the manifest**

Run:

~~~
pnpm install --lockfile-only
pnpm install --frozen-lockfile
~~~

Expected: the lockfile contains the apps/web Angular 21 / PrimeNG 21.1.9 graph, retains TypeScript 6.0.3 for API/contracts, and installs without a peer override or --force flag.

- [ ] **Step 3: Prove the license path is gone**

Run:

~~~
rg -n "primeng@22|@primeuix/themes@3\.0\.0|@primeui/license-manager|\"primeng\": \"22\.0\.0\"" apps/web/package.json pnpm-lock.yaml
~~~

Expected: no matches. The lockfile must not retain the PrimeNG 22 license-manager dependency through the web graph.

---

### Task 3: Confirm source compatibility without redesign

**Files:**
- Inspect: apps/web/src/app/app.config.ts
- Inspect: apps/web/src/app/**/*.ts
- Modify: apps/web/src/app/settings/question-bank.page.html:273
- Inspect: apps/web/src/styles.scss

**Interfaces:**
- Consumes: the installed web graph from Task 2.
- Produces: a compiled Angular 21 application with the existing routes, forms, and PrimeNG components intact, plus one null-safe interpolation in the question-bank list.

- [ ] **Step 1: Confirm the existing provider configuration remains valid**

Verify that apps/web/src/app/app.config.ts still imports Aura from @primeuix/themes/aura, imports providePrimeNG from primeng/config, and retains the existing darkModeSelector: false option. Do not add license configuration.

- [ ] **Step 2: Confirm no v21-incompatible API is present**

Run:

~~~
rg -n --hidden -g '!**/node_modules/**' -g '!**/.git/**' "showTransitionOptions|hideTransitionOptions|@angular/animations|provideAnimationsAsync" apps/web/src
~~~

Expected: no matches. Existing styleClass usages are retained because v21 still supports them; no template rewrite is needed for this slice.

- [ ] **Step 3: Run the narrow web verification**

Run:

~~~
pnpm --filter @project-maker/web typecheck
pnpm --filter @project-maker/web build
~~~

Expected: both commands pass, the build output remains apps/web/dist/web/browser, and the only source change is the null-safe question.options interpolation in apps/web/src/app/settings/question-bank.page.html. If either command fails, stop and report the compiler error rather than suppressing it with peer overrides or broad refactoring.

---

### Task 4: Make the current dependency policy truthful in documentation

**Files:**
- Modify: README.md:5 and the frontend dependency description near the install section.
- Modify: docs/operations-handoff.md:13

**Interfaces:**
- Consumes: the exact versions locked in Task 2.
- Produces: documentation that does not claim Angular 22 while the web is Angular 21 and records the deliberate PrimeNG upgrade boundary.

- [ ] **Step 1: Update the README platform line**

Replace the current web bullet with:

~~~
- apps/web: Angular 21.2 single-page application with PrimeNG 21.1.9 (MIT baseline).
~~~

- [ ] **Step 2: Add the explicit upgrade boundary**

Add this paragraph after the platform description:

~~~
The web baseline intentionally pins PrimeNG to 21.1.9 and Angular 21.2.x. Upgrading to PrimeNG 22 or a later major requires a separate license and Angular-compatibility review because PrimeNG 22 uses the PrimeUI licensing model.
~~~

- [ ] **Step 3: Update the operations matrix**

Replace the web row in docs/operations-handoff.md with:

~~~
| web | Angular 21.2 + PrimeNG 21.1.9 static application served by Nginx; proxies /api/* | Publishes WEB_PORT (default 8080) |
~~~

- [ ] **Step 4: Check for stale current-state version claims**

Run:

~~~
rg -n --hidden -g '!**/node_modules/**' -g '!**/.git/**' "Angular 22|22\.1\.0|22\.1\.2|PrimeNG 22|@primeuix/themes.*3\.0\.0" README.md docs apps/web
~~~

Expected: no stale Angular 22 dependency claim remains; the intentional PrimeNG 22 upgrade-policy sentence in README.md is the only expected match.

---

### Task 5: Rebuild the container and perform the user-visible license smoke gate

**Files:**
- Inspect: apps/web/Dockerfile
- Inspect: compose.yaml

**Interfaces:**
- Consumes: the rebuilt lockfile, web bundle, and documentation from Tasks 2–4.
- Produces: a healthy Compose stack and a browser-visible web app without PrimeUI license warnings.

- [ ] **Step 1: Validate Compose configuration**

Run:

~~~
pnpm compose:config
~~~

Expected: exit code 0 with no configuration error.

- [ ] **Step 2: Rebuild the stack**

Run:

~~~
pnpm compose:up
docker compose --env-file .env ps
~~~

Expected: postgres, api, and web are healthy; the web service still publishes the configured host port and the API/database remain unchanged.

- [ ] **Step 3: Check the generated bundle for the removed warning**

Run:

~~~
rg -n "Invalid PrimeUI License|PrimeUI license|@primeui/license-manager" apps/web/dist/web/browser
~~~

Expected: no matches.

- [ ] **Step 4: Check the live application**

Open http://localhost:8080/, the project list, one project cockpit, interview, and Markdown route. Confirm that the existing UI loads, forms remain usable, and the red Invalid PrimeUI License toast and [PrimeUI] PrimeUI license is not configured. console message are absent.

- [ ] **Step 5: Leave the database and services recoverable**

Do not run migrations, delete volumes, or reset seed data. If the browser gate fails, stop the stack only with the existing pnpm compose:down command after recording the failure; no data rollback is required because this slice changes no schema or persisted records.

---

### Task 6: Prepare the review handoff without publishing

**Files:**
- Review: all files changed by Tasks 2–4.

**Interfaces:**
- Consumes: verification output from Tasks 2–5.
- Produces: a reviewable, uncommitted diff and an evidence summary; no commit, branch merge, or push.

- [ ] **Step 1: Inspect the final diff**

Run:

~~~
git diff --check
git diff --stat
git status --short
~~~

Expected: only apps/web/package.json, pnpm-lock.yaml, README.md, and docs/operations-handoff.md are changed; no generated secrets, Docker volume changes, API files, or unrelated formatting noise appear.

- [ ] **Step 2: Re-run the state gate after the local rebuild**

Run:

~~~
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
~~~

Record the fresh branch, HEAD, worktree, and changed-path evidence in the handoff. Do not describe the implementation as merged or published.

- [ ] **Step 3: Stop for user review**

Present the exact dependency diff, peer-compatibility result, build/Compose/browser evidence, and any failure. Wait for explicit approval before creating a commit, merging to main, or pushing to GitHub.

## Acceptance Criteria

- apps/web is pinned to the Angular 21.2 / PrimeNG 21.1.9 compatible graph listed above.
- Web TypeScript is 5.9.3; API and contracts remain on TypeScript 6.0.3.
- pnpm install --frozen-lockfile, web typecheck, and web production build pass without peer override flags.
- @primeui/license-manager, PrimeNG 22, and @primeuix/themes 3 are absent from the web lock graph.
- Compose configuration, API health, PostgreSQL health, and Nginx health remain green after rebuild.
- The live app renders the existing project, interview, and Markdown flows without the PrimeUI license toast or console warning.
- No database migration, API contract, SMTP behavior, VPN boundary, or persisted project data changes.
- The final diff is limited to the five planned files and remains uncommitted pending user approval.

## Rollback / Recovery

The change is dependency-, documentation-, and one-line template-only. If the compatibility gate fails, stop before publication and preserve the diff for review. Recovery consists of restoring the five changed files to the reviewed baseline and reinstalling the existing frozen lockfile; no database or runtime data rollback is needed. Do not use git reset --hard, git clean, or volume deletion as a recovery mechanism.

## Sources

- PrimeNG v21 migration guide: https://primeng.dev/migration/v21
- PrimeTek PrimeUI licensing transition: https://primeui.dev/nextchapter
- PrimeNG npm versions and v21-stable: https://www.npmjs.com/package/primeng?activeTab=versions
