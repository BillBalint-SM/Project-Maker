# Project Maker documentation

All maintained product, engineering, user, and operational documentation is written in professional English. Legacy Hungarian wire or storage values are retained only where a document explicitly identifies them as compatibility data.

## Start here

- [End-user guide](user-guide.md) — current daily workflows, states, side effects, recovery paths, and limitations.
- [Visual maps](visual-maps.md) — interactive workflow, lifecycle, communication, dataflow, and runtime architecture views.
- [Current roadmap](roadmap.md) — delivered capability, planned work, opportunities, and improvements.
- [Product domain](product-domain.md) — platform-neutral intent and vocabulary; not a delivery-status record.
- [Configuration reference](configuration.md) — authoritative environment-variable definitions, defaults, constraints, and failure behavior.
- [Operations handoff](operations-handoff.md) — deployment, migration, recovery, mail, and verification guidance.
- [Release cutover checklist](release-cutover.md) — independent application and Operator mail-gateway activation gates.
- [Operator mail gateway](mail-gateway.md) — TLS SMTP/IMAP activation, controlled smoke, recovery, and credential rotation.

## Architecture and decisions

- [Runtime Architecture visual map](visual-maps.md#runtime-architecture)
- [Feature and Dataflow visual map](visual-maps.md#feature-and-data-flow)
- [ADR-0001: domain-aligned Project cockpit](adr/0001-domain-aligned-project-cockpit.md)
- [ADR-0002: pre-delivery Decision Score policy correction](adr/0002-pre-delivery-decision-score-policy-correction.md)
- [ADR-0003: Operator organization-provided mail gateway](adr/0003-use-operator-provided-mail-gateway.md)
- [ADR-0004: Project operation policy](adr/0004-project-operation-policy.md)
- [ADR-0005: bounded attachment storage in PostgreSQL](adr/0005-store-bounded-attachments-in-postgresql.md)
- [ADR-0006: Claude Code through Project Maker MCP](adr/0006-connect-claude-code-through-project-maker-mcp.md)
- [ADR-0007: command-local pending state](adr/0007-command-local-pending-state.md)

ADRs preserve the reason and consequences of accepted decisions. Superseded implementation details remain historical context and are labelled accordingly.

## Attachments

- [ATTACH-01 delivered design](attach-01-governed-discovery-attachments.md) — bounded Question Bank reference files and Project-owned discovery files without a general document library.
- [ATTACH-01 supporting research](research/attach-01-file-upload-best-practices.md) — historical primary-source research considered during design; it is not the current runtime contract.
