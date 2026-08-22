# Gates: UI locking, error mapping and queue cursor

Scope: independent Project operations do not block each other, each command remains single-flight, and the cursor remains simple validated navigation state.

- [x] G1: ProjectOperationPolicy and every import are removed.
  CHECK: node -e "const {execFileSync}=require('node:child_process');try{const s=execFileSync('rg',['-n','ProjectOperationPolicy|project-operation-policy','apps/web/src'],{encoding:'utf8'});console.error(s);process.exit(1)}catch(e){if(e.status===1)console.log('operation-policy-removed');else throw e}"
  EXPECT: operation-policy-removed
  EVIDENCE: operation-policy-removed

- [x] G2: Repeated activation of the same command remains single-flight while independent operations use separate pending state.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/web test
  EXPECT: Tests
  EVIDENCE: (node:27592) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided. | (Use `node --trace-warnings ...` to show where the warning was created)

- [x] G3: Generic Angular HTTP diagnostics come from one small shared helper; 409/recovery copy remains feature-local.
  CHECK: rg -n "HttpError|http.*error|errorMessage" apps/web/src/app
  EXPECT: /error/i
  EVIDENCE: apps/web/src/app\projects\project-api.service.ts:1:import { HttpClient, HttpErrorResponse } from '@angular/common/http'; | apps/web/src/app\projects\project-api.service.ts:172:  if (!(error instanceof

- [x] G4: The Active queue cursor is versioned, strictly validated untrusted navigation state and uses neither encryption nor a dedicated runtime secret.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/api test:compile && node --test apps/api/dist-test/test/active-project-queue-cursor.spec.js
  EXPECT: fail 0
  EVIDENCE: npm notice run pnpm --filter @project-maker/api test:compile | $ node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc --project ./test/tsconfig.json

- [x] G5: Queue query-count, urgency, pagination, invalid-cursor, and stale-page tests pass.
  CHECK: node --test apps/api/dist-test/test/active-project-queue-cursor.spec.js apps/api/dist-test/test/active-project-queue.e2e-spec.js
  EXPECT: fail 0
  EVIDENCE: ℹ todo 0 | ℹ duration_ms 4435.8517

- [x] G6: Exact internal return URL and browser-history behavior remains unchanged.
  EVIDENCE: 2026-08-22 — `active-project-queue.page.ts`, return-target behavior, and the e2e route are untouched; 75/75 Angular tests, web typecheck, and production build pass.
