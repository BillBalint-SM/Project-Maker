# Gates: simplification preservation baseline

Scope: one compact audit matrix records safe cuts, conditional cuts, protected behavior, and the supported upgrade boundary.

- [x] G1: Every protected behavior has an authoritative source and a primary verification seam.
  CHECK: rg -n "Authoritative source|Primary verification seam" docs/simplification-baseline.md
  EXPECT: Primary verification seam
  EVIDENCE: 11:behavior.  `Primary verification seam` is the one focused test file to run | 14:| Protected behavior | Cut classification | Authoritative source | Primary verification seam |

- [x] G2: Queue cursor/navigation state, return URL/history, recovery, query count, and Budapest urgency are explicitly protected.
  CHECK: rg -n "cursor|returnTo|query count|Budapest|recovery" docs/simplification-baseline.md
  EXPECT: Budapest
  EVIDENCE: 23:| Customer-mail recovery retains outbound attempts and Customer correspondence; IMAP checkpoint/UIDVALIDITY reset, duplicate-safe ingestion, plus-address correlation, explicit unmatched-message tri

- [x] G3: The complete Customer-mail and Specification retention boundary is explicitly protected.
  CHECK: rg -n "FAILED|UNKNOWN|UIDVALIDITY|template provenance|source snapshot|correlation" docs/simplification-baseline.md
  EXPECT: UIDVALIDITY
  EVIDENCE: 25:| Specification output is an immutable, versioned Project specification with rendered Markdown, explicit revision reason and change summary, source snapshot, and history; later Project data cannot

- [x] G4: The oldest-supported database state and squash/no-squash decision are explicit.
  CHECK: rg -n "Oldest supported|squash|no-squash" docs/simplification-baseline.md
  EXPECT: Oldest supported
  EVIDENCE: 33:**Oldest supported deployed database state:** the database already carrying | 41:**Decision: no-squash.** Do not squash or replace migrations 0001–0031 while

- [x] G5: Every audit item is classified as `safe internal cut`, `conditional`, or `do not cut`.
  CHECK: rg -n "safe internal cut|conditional|do not cut" docs/simplification-baseline.md
  EXPECT: do not cut
  EVIDENCE: 51:- `conditional` — remove or consolidate only after the listed primary seam | 54:- `do not cut` — preserve the behavior and its retained data; replace internals
