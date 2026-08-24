---
status: accepted
---

# Version specification source provenance

New Specification versions retain source contract v2 in the same transaction as
their rendered Markdown. It extends the v1 Project, question-schema, and interview
snapshot with current Insights, only their referenced Evidence, Discovery
follow-ups, readiness, Decision Review, and the latest formal decision.

The server appends one canonical `Decision and Evidence Provenance` section after
the selected template. Broken Evidence, Insight, or source-question references
block generation. Stored v1 snapshots remain readable without migration or
backfill, and the browser continues to display the immutable server-rendered
Markdown rather than reproducing provenance rules.

Revision list endpoints return metadata summaries; detail and MCP reads retain
the full immutable revision. No semantic conflict detector, historical-decision
copy, frontend provenance store, or new validation dependency is introduced.

**Evidence:** [shared source contract](../../packages/contracts/src/markdown-revisions.ts),
[snapshot and renderer](../../apps/api/src/markdown/markdown.service.ts), and
[API behavior](../../apps/api/test/projects.e2e-spec.ts).
