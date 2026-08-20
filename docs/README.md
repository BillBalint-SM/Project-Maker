# Project Maker documentation

## Start here

- [Hungarian end-user guide](user-guide.md) — daily business workflows, state meanings, safe recovery, and current limitations for employees.
- [Current roadmap](roadmap.md) — delivered capability, planned work, opportunities, and improvements.
- [Product domain](product-domain.md) — platform-neutral intent and vocabulary; not a delivery-status record.
- [Operations handoff](operations-handoff.md) — runtime, recovery, email, and verification guidance.
- [Release cutover checklist](release-cutover.md) — separate application go-live from Operator organization-operated mail-gateway activation, with owners, gates, rollback, and sign-off.
- [Operator mail gateway](mail-gateway.md) — TLS SMTP/IMAP activation, controlled smoke, recovery, and credential rotation.

## Architecture and decision records

- [Project context and operation policy decision](adr/0004-project-operation-policy.md)
- [Decision Score policy-correction decision](adr/0002-pre-delivery-decision-score-policy-correction.md)
- [Operator mail gateway decision](adr/0003-use-operator-provided-mail-gateway.md)
- [Bounded attachment storage decision](adr/0005-store-bounded-attachments-in-postgresql.md)
- [Current requirement checklist](../.planning/REQUIREMENTS.md) — checked only with delivery evidence.

## Accepted designs pending implementation

- [ATTACH-01 governed discovery attachments](attach-01-governed-discovery-attachments.md) — final implementation plan for bounded Question Bank guidance and Project-owned discovery files without a general document library.
- [ATTACH-01 primary-source research](research/attach-01-file-upload-best-practices.md) — security, streaming, scanner, retry, storage, accessibility, recovery, and performance evidence behind the final plan.

## End-user guidance

The [Hungarian end-user guide](user-guide.md) is the canonical daily-work
manual for PM, PO, BA, and discovery workers using the stable delivered webapp.
