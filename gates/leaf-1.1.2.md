# Gates: delivery-state reconciliation

Scope: local documentation separates delivered implementation from genuinely open opportunities.

- [x] G1: Delivered Batch 1–5 requirements are checked and include evidence links.
  CHECK: rg -n "\[x\].*(CONTACT-01|ROUNDS-02|INSIGHT-01|ATTACH-01|PLAYBOOK-02|COLLAB-01|NOTIFY-01|DECISION-01|STATUS-01|PORTFOLIO-01|ROADMAP-01|SEC-01)" .planning/REQUIREMENTS.md
  EXPECT: SEC-01
  EVIDENCE: 46:- [x] **ROADMAP-01:** Business goals group Initiatives and Projects. Confirmed container deletion unassigns Projects instead of requiring manual emptying. | 62:- [x] **SEC-01:** The VPN restricts r

- [x] G2: The roadmap lists simplification packages according to their actual local state.
  CHECK: rg -n "SIMPLIFY-02|SIMPLIFY-03|SIMPLIFY-04|SIMPLIFY-05" docs/roadmap.md
  EXPECT: SIMPLIFY-05
  EVIDENCE: 88:| `SIMPLIFY-04` | Canonicalize Customer-mail persistence | New/linked Customer-mail records use immutable outbound/correspondence/attempt storage; old incomplete mail records remain readable rather

- [x] G3: ADR-0004 status reflects removal of the cross-feature lease.
  CHECK: rg -n "status: superseded|superseded-by" docs/adr/0004-project-operation-policy.md
  EXPECT: status: superseded
  EVIDENCE: 2:status: superseded

- [x] G4: Operations documentation describes the actual runtime-secret and migration model.
  CHECK: rg -n "supported.*baseline|checkpoint" docs/operations-handoff.md
  EXPECT: /baseline|checkpoint/i
  EVIDENCE: 110:19. `0019-customer-mailbox-sync.ts` — durable dedicated-mailbox identity, completed historical checkpoint, bounded freshness/failure state, synchronization timestamps, lease ownership, and retaine

- [x] G5: Future opportunities are not presented as delivered.
  EVIDENCE: 2026-08-22 — `ATTACH-01`, `DATA-03`, `MIG-01`, and `PWA-01` remain open and the roadmap does not claim complete delivery. `PROJECT-UX-01` is now correctly delivered with lifecycle, editability, deletion-boundary, and archived-output evidence; `COLLAB-01` remains correctly delivered because Customer response drafts have browser-local persistence evidence.
