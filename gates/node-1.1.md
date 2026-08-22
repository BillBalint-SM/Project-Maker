# Gates: contract and state integration

Scope: baseline and actual delivery state form one consistent documentation view.

- [x] G1: Every baseline leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.1.1.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.1.1.md: 5 gates | ALL MET (5 met)

- [x] G2: Every reconciliation leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.1.2.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.1.2.md: 5 gates | ALL MET (5 met)

- [x] G3: Documentation never claims both PLANNED and DELIVERED for the same implemented requirement.
  EVIDENCE: 2026-08-22 — delivered items were removed from the PLANNED table; only partially or wholly undelivered requirements remain open.

- [x] G4: Documentation introduces no new approval, role, or tracker workflow.
  EVIDENCE: 2026-08-22 — VPN, self-service identity, and equal capabilities remain; there is no RBAC, membership, tenant, or new delivery-control gate.

- [x] G5: Baseline and operations documentation state the same supported migration boundary.
  EVIDENCE: 2026-08-22 — both record the explicit no-squash 0001 -> 0032 forward chain.
