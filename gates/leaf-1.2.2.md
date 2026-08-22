# Gates: contracts runtime and production image

Scope: one contracts runtime build serves API, web, tests, and container; the runtime image receives runtime content only.

- [x] G1: There is no separate generated CJS loader, runtime tsconfig, or API-owned playbook copy step.
  CHECK: node -e "const fs=require('node:fs');const bad=['packages/contracts/scripts/prepare-cjs-runtime.mjs','packages/contracts/tsconfig.runtime.json','apps/api/scripts/copy-general-playbook.mjs'].filter(fs.existsSync);if(bad.length){console.error(bad.join(','));process.exit(1)}console.log('single-contracts-runtime')"
  EXPECT: single-contracts-runtime
  EVIDENCE: single-contracts-runtime

- [x] G2: Contracts build, API typecheck, and web typecheck pass through the same package export.
  CHECK: npx.cmd --yes pnpm@11.20.0 typecheck
  EXPECT: typecheck
  EVIDENCE: $ pnpm --filter @project-maker/contracts build && pnpm -r --if-present typecheck | $ tsc --project tsconfig.json

- [x] G3: The zoneless Angular app does not declare a direct zone.js runtime dependency.
  CHECK: node -e "const p=require('./apps/web/package.json');if(p.dependencies&&p.dependencies['zone.js'])process.exit(1);console.log('zonejs-removed')"
  EXPECT: zonejs-removed
  EVIDENCE: zonejs-removed

- [x] G4: The production API image contains neither a pnpm executable nor a full development-workspace install.
  EVIDENCE: `docker compose --env-file .env.example build api` succeeded; `docker run --rm --entrypoint sh project-maker-api:latest -c 'test ! -e /usr/local/bin/pnpm && test ! -e /workspace/pnpm-lock.yaml && test ! -d /workspace/apps && test -f /workspace/node_modules/@project-maker/contracts/dist/index.js'` exited 0.

- [x] G5: API-container migration, health, and canonical-policy consumer smoke pass.
  CHECK: node scripts/run-container-smoke.mjs
  EXPECT: Container smoke passed
  EVIDENCE: Volume project-maker-container-smoke-30656-1787361399591_postgres-data Removed | Network project-maker-container-smoke-30656-1787361399591_project-maker-internal Removed
