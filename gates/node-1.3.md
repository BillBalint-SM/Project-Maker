# Gates: persistence integration

Scope: Customer-mail normalization and migration simplification preserve all retained data together.

- [x] G1: Every Customer-mail persistence leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.3.1.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.3.1.md: 5 gates | ALL MET (5 met)

- [x] G2: Every migration-history leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.3.2.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.3.2.md: 5 gates | ALL MET (5 met)

- [x] G3: A fresh database reaches the current schema through the complete canonical forward chain.
  EVIDENCE: 2026-08-22 — both the migration suite and isolated production container started through a fresh 0001 -> 0032 chain.

- [x] G4: The fixture starting from the oldest-supported state retains representative business data.
  EVIDENCE: 2026-08-22 — `supported-migration-sequence.e2e-spec.ts` passes 1/1 and the 0031 -> 0032 mail proof passes 1/1.

- [x] G5: Customer-mail, Specification, audit, attachment, identity, and Git handoff retention remains unchanged.
  EVIDENCE: 2026-08-22 — the forward fixture preserves representative mail, Specification, audit, attachment, and identity data byte-for-byte; delivery/Git schema is unchanged and full root verification follows.
