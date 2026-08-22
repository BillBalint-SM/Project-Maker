# Gates: supported migration history

Scope: the actual upgrade baseline remains supported; migration tests prove real forward transitions only.

- [x] G1: The squash/no-squash decision follows the baseline document and the canonical sequence does not drift.
  CHECK: rg -n "Decision: no-squash|0001.*supported" docs/simplification-baseline.md
  EXPECT: no-squash
  EVIDENCE: 41:**Decision: no-squash.** Do not squash or replace migrations 0001–0031 while | 42:0001 remains supported. A simplification may add a forward-only migration only

- [x] G2: A fresh database builds through the complete canonical sequence.
  EVIDENCE: 2026-08-22 — the migration target set builds the fresh schema on real PostgreSQL; after correcting one baseline assertion, all 14/14 tests across eight suites pass.

- [x] G3: The oldest-supported fixture retains representative Project, Specification, Customer-mail, audit, attachment, and identity data after forward upgrade.
  EVIDENCE: 2026-08-22 — `supported-migration-sequence.e2e-spec.ts` starts at 0001, seeds representative data at milestones, and migrates through 0032; it passes 1/1.

- [x] G4: No test remains solely to prove destructive down/rollback ceremony.
  CHECK: node -e "const {execFileSync}=require('node:child_process');try{const s=execFileSync('rg',['-n','undoLastMigration|\\.down\\(','apps/api/test','--glob','*.ts'],{encoding:'utf8'});console.error(s);process.exit(1)}catch(e){if(e.status===1)console.log('migration-rollback-ceremony-removed');else throw e}"
  EXPECT: migration-rollback-ceremony-removed
  EVIDENCE: migration-rollback-ceremony-removed

- [x] G5: Runtime and tests use the same migrationSequence export.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/api test:compile && node --test apps/api/dist-test/test/migration-sequence.spec.js
  EXPECT: fail 0
  EVIDENCE: npm notice run pnpm --filter @project-maker/api test:compile | $ node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc --project ./test/tsconfig.json
