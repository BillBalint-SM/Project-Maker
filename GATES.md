# Gates: remaining simplification work

Scope: complete every accepted simplification that can be implemented locally without changing protected product behavior.

- [x] G1: The preservation baseline and supported migration boundary are explicit, with one primary proof seam for every protected surface.
  CHECK: rg -n "Oldest supported|safe internal cut|conditional|do not cut|Primary verification seam" docs/simplification-baseline.md
  EXPECT: Primary verification seam
  EVIDENCE: docs/simplification-baseline.md records protected behavior, the oldest-supported 0001 boundary, and primary verification seams; leaf 1.1.1 passes 5/5.

- [x] G2: Project operations no longer share a cross-feature UI lease, while same-command single-flight remains.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.2.1.md
  EXPECT: ALL MET
  EVIDENCE: leaf 1.2.1 passes 6/6; command-local pending and stale-response tests, 75/75 Angular tests, and 14/14 queue e2e tests pass.

- [x] G3: The contracts runtime and production API image use one supported runtime distribution without pnpm or a full workspace install.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.2.2.md
  EXPECT: ALL MET
  EVIDENCE: leaf 1.2.2 passes 5/5; 18/18 contracts tests and the pruned production-image smoke prove the single CommonJS runtime.

- [x] G4: Customer-mail state has one canonical outbound/attempt persistence path and a simple validated checkpoint without data loss.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.3.1.md
  EXPECT: ALL MET
  EVIDENCE: leaf 1.3.1 passes 5/5; 72/72 mail tests and the real 0031 -> 0032 preservation proof pass.

- [x] G5: The migration chain preserves the actual supported baseline without unsupported rollback ceremony.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.3.2.md
  EXPECT: ALL MET
  EVIDENCE: leaf 1.3.2 passes 5/5; the 0001 -> 0032 fixture retains data, with 14/14 migration and 21/21 round-integrity tests passing.

- [x] G6: Requirements, roadmap, ADR, and operations documentation reflect the actual local state.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.1.2.md
  EXPECT: ALL MET
  EVIDENCE: leaf 1.1.2 and node 1.1 both pass 5/5; delivered and deliberately open scope has evidence links.

- [x] G7: Full repository typecheck, tests, and production builds pass.
  CHECK: npx.cmd --yes pnpm@11.20.0 verify
  EXPECT: Tests
  EVIDENCE: pnpm verify passed: contracts 18/18, web 75/75, API 244/244, all typechecks, and all production builds.

- [x] G8: A fresh API container starts through migrations and passes the authenticated canonical-policy smoke.
  CHECK: node scripts/run-container-smoke.mjs
  EXPECT: Container smoke passed
  EVIDENCE: isolated scripts/run-container-smoke.mjs passed fresh 0001 -> 0032 migration, health, canonical import, and authenticated Project policy route; temporary resources were removed.

- [x] G9: The final worktree diff is structurally clean and contains no abandoned placeholder in touched code.
  CHECK: git diff --check
  EXPECT: /^(?!.*error)/s
  EVIDENCE: git diff --check passes; touched source contains no TODO/FIXME or retired runtime-secret reference.

## Main delivery gates

- [x] G10: Local and remote `main` still share the recorded delivery base.
  CHECK: git rev-list --left-right --count main...origin/main
  EXPECT: 0 0
  EVIDENCE: the fetched `main` and `origin/main` both point to `b71b623ee4f94a4d23cc7d1478a804bcb0def879`; work continues on `codex/simplification-main-readiness`.

- [x] G11: GitHub workflow syntax and referenced action tags are valid.
  CHECK: actionlint .github/workflows/ci.yml and resolve every `uses:` tag
  EXPECT: no workflow error and every tag exists
  EVIDENCE: containerized actionlint reports no error; `actions/checkout@v7`, `actions/setup-node@v7`, and `pnpm/action-setup@v6` all resolve to Git tags.

- [x] G12: The three GitHub jobs have matching successful local evidence.
  CHECK: npx.cmd --yes pnpm@11.20.0 verify; npx.cmd --yes pnpm@11.20.0 test:mail-gateway; node scripts/run-container-smoke.mjs
  EXPECT: all commands pass in their documented isolated database boundaries
  EVIDENCE: a fresh PostgreSQL checkpoint passed 18/18 contracts, 75/75 web, and 244/244 API tests plus all builds; mail-gateway passed 72/72 targeted tests and 1/1 browser journey; the pruned Node 26.4.0 production image passed fresh `0001 -> 0032`, health, runtime import, and authenticated-policy smoke.

- [x] G13: The proposed branch contains only the intended implementation,
  forward migration, tests, runtime changes, and reconciled documentation.
  CHECK: git diff --check and final staged-scope review
  EXPECT: no structural error, secret, generated output, or unrelated change
  EVIDENCE: all 91 changed paths map to the planned runtime, UI, Customer-mail, migration, verification, or documentation batches; diff-check and token-shape scan pass, and ignored/generated test outputs are absent from status.

- [ ] G14: One pull request reaches `main` with `checkpoint`, `mail-gateway`,
  and `container-smoke` green.
  EVIDENCE: pending separate push, pull-request, and merge authority
