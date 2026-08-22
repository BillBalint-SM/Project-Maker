# SIMPLIFY-00 — behavior-preservation baseline

This is the single simplification audit matrix.  It uses the terms in
[`CONTEXT.md`](../CONTEXT.md), especially **Active project queue**, **Selected
project context**, **Customer correspondence**, **Correspondence mailbox**, and
**Specification version**.  ADR-0003 keeps the mail boundary at the Operator
organization's SMTP/IMAP gateway; ADR-0006 keeps Internal-user identity and
actor-bound audit across web and MCP writes.

`Authoritative source` is the one implementation boundary that defines the
behavior.  `Primary verification seam` is the one focused test file to run
when a proposed cut touches it; it is not a permanent gate or a blanket suite.

| Protected behavior | Cut classification | Authoritative source | Primary verification seam |
| --- | --- | --- | --- |
| Active project queue: versioned, strictly validated cursor navigation state; app-issued cursors reject a different query/filter, malformed and obsolete anchors fail safely, and no authorization decision trusts cursor content | do not cut | `apps/api/src/projects/active-project-queue.service.ts` | `apps/api/test/active-project-queue.e2e-spec.ts` |
| Active project queue: stable urgency/due-time/Hungarian-name/id order; forward/backward traversal has no overlap; exactly 10 items; bounded query count and one-page SQL read | do not cut | `apps/api/src/projects/project-work-state-read-model.ts` | `apps/api/test/active-project-queue.e2e-spec.ts` |
| Active queue urgency uses the controlled clock and `Europe/Budapest` calendar (including DST); stale, malformed, or mismatched cursor recovery is safe | do not cut | `apps/api/src/projects/active-project-queue.service.ts` | `apps/api/test/active-project-queue.e2e-spec.ts` |
| Queue UI search/filter/cursor is reload-safe replace-history state. Project links preserve the exact internal `returnTo`; Back returns to that queue context, not a hidden global selection | do not cut | `apps/web/src/app/projects/active-project-queue.page.ts` | `apps/web/e2e/active-project-queue.spec.ts` |
| Queue refresh failure retains the existing queue context and announces recovery; obsolete URL recovery removes only the unusable cursor | conditional | `apps/web/src/app/projects/active-project-queue.page.ts` | `apps/web/e2e/active-project-queue.spec.ts` |
| Full Customer-mail preview is complete before send and binds sender, recipient, Reply-To correlation, rendered subject/text/HTML, digest, and source content version into an immutable outbound snapshot | do not cut | `apps/api/src/interview-customer-handoffs/interview-customer-handoff.service.ts` | `apps/api/test/interview-customer-handoff.e2e-spec.ts` |
| Operator SMTP/IMAP boundary: mail-system acceptance is not delivery; `FAILED` and `UNKNOWN` remain distinct; only explicit manual retry is allowed, and `UNKNOWN` requires duplicate-risk acknowledgement/receipt check | do not cut | `apps/api/src/interview-customer-handoffs/interview-customer-handoff.service.ts` | `apps/api/test/interview-customer-handoff.e2e-spec.ts` |
| Customer-mail recovery retains outbound attempts and Customer correspondence; IMAP checkpoint/UIDVALIDITY reset, duplicate-safe ingestion, plus-address correlation, explicit unmatched-message triage, and message/correlation deduplication remain lossless | do not cut | `apps/api/src/customer-mailbox-sync/customer-mailbox-sync.service.ts` | `apps/api/test/customer-replies.e2e-spec.ts` |
| Customer-mail retention: retain safe human-readable inbound text and bounded attachment metadata, redact secrets/raw unsafe payloads, and keep correspondence readable after Project archive; do not retain attachment content | do not cut | `apps/api/src/customer-mailbox-sync/customer-mailbox-sync.service.ts` | `apps/api/test/customer-mailbox-sync.e2e-spec.ts` |
| Specification output is an immutable, versioned Project specification with rendered Markdown, explicit revision reason and change summary, source snapshot, and history; later Project data cannot rewrite it | do not cut | `apps/api/src/markdown/markdown.service.ts` | `apps/api/test/projects.e2e-spec.ts` |
| Specification template provenance records the selected published template name/version; template edits/publishing cannot rewrite prior versions | do not cut | `apps/api/src/markdown/markdown.service.ts` | `apps/api/test/projects.e2e-spec.ts` |
| Local Internal-user identity, deactivation, and credential recovery semantics | do not cut | `apps/api/src/auth/auth.service.ts` | `apps/api/test/auth.e2e-spec.ts` |
| Audit actor attribution and redaction, including the same actor-bound rules for MCP writes | do not cut | `apps/api/src/mcp/project-maker-mcp.server.ts` | `apps/api/test/mcp.e2e-spec.ts` |
| Historical database upgrade path | conditional | `apps/api/src/database/migration-sequence.ts` | `apps/api/test/migration-sequence.spec.ts` |

## Migration baseline

**Oldest supported deployed database state:** the database already carrying
`Core0001Core1785916800000` (migration 0001), with its TypeORM migration
history intact. This is the oldest state the repository can evidence: the
canonical runtime sequence starts at 0001 and `migrationsThrough()` constructs
an inclusive prefix from it. An unmigrated database, a schema changed outside
this sequence, and a database with a rewritten migration history are not
supported deployment states.

**Decision: no-squash.** Do not squash or replace migrations 0001–0031 while
0001 remains supported. A simplification may add a forward-only migration only
when it preserves retained Project, Customer correspondence, Specification,
identity, and audit data and is proven from the stated baseline. Changing this
support boundary is a separate compatibility decision, not an internal cut.

## How to use the classifications

- `safe internal cut` — none in this baseline: there is no independently
  disposable implementation among these protected boundaries.
- `conditional` — remove or consolidate only after the listed primary seam
  still proves the stated behavior (and, for migrations, after a deliberate
  support-boundary decision).
- `do not cut` — preserve the behavior and its retained data; replace internals
  only behind the authoritative source and verify at the listed seam.
