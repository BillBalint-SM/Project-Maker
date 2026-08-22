# Gates: UX audit contract and language branch

Scope: integrate nullable optional-resource reads and professional-English completion.

- [x] G1: The contract/language leaf is parent-verified.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-contract-english.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-contract-english.md: 8 gates | ALL MET (8 met)

- [x] G2: API and web TypeScript agree on the nullable read contract.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/contracts build && npx.cmd --yes pnpm@11.20.0 --dir apps/api typecheck && npx.cmd --yes pnpm@11.20.0 --dir apps/web typecheck
  EXPECT: /Done|completed|tsc/
  EVIDENCE: npm notice run pnpm --dir apps/web typecheck | $ tsc --project tsconfig.app.json --noEmit

- [x] G3: The two focused API E2E files pass together.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/api test:compile && node --test --test-concurrency=1 ./apps/api/dist-test/test/question-bank-reference-files.e2e-spec.js ./apps/api/dist-test/test/delivery-package.e2e-spec.js
  EXPECT: /fail 0/
  EVIDENCE: npm notice run pnpm --dir apps/api test:compile | $ node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc --project ./test/tsconfig.json

- [x] G4: Driver review confirms exports, MCP reads, write conflicts, user-authored text, and historical values remain unchanged.
  EVIDENCE: Reviewed every `DeliveryPackageService.find/get` caller and the Question Schema read path. Only the two collection-like browser GETs use successful nullable absence; artifact/Markdown/CSV/print exports and MCP context retain the strict `get` path, while Git handoff still requires `entity()` and its existing conflict. No DTO, persistence, authored content, wire enum, or historical record was changed. The copy edits are limited to four accepted literals and current documentation standards.

- [x] G5: Product copy uses professional English and documentation consistently quotes current English UI labels; explanatory prose may remain in its intended reader language.
  CHECK: rg -n "professional English" .agents/skills/project-maker-angular-conventions/SKILL.md PLAN.md docs/roadmap.md docs/user-guide.md
  EXPECT: professional English
  EVIDENCE: PLAN.md:164:| 2.2.1 | `UX-AUDIT-005/006`: successful optional-resource absence plus complete professional English | Question Schema and Delivery Package API/controller/tests; related web adapters/test
