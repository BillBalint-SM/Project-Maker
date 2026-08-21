---
status: accepted
---

# Store bounded ATTACH-01 content in PostgreSQL first

ATTACH-01 stores its first-release file bytes in a dedicated PostgreSQL `bytea`
table. A configurable per-file limit, defaulting to 50 MiB, keeps the feature
inside the platform's one existing durable boundary. Introducing object storage,
a repository adapter, independent credentials, cross-system consistency, and a
second backup path before measured need would add work without helping the first
release.

## Consequences

- Size, type/signature, owner, and filename checks complete before the one
  transaction that stores bytes and their relationship.
- Existing PostgreSQL backup and restore operations cover the retained content;
  ATTACH-01 adds no separate recovery subsystem or release gate.
- Content is not deduplicated and the first release has no storage abstraction.
- Reconsider object storage only when observed database size, memory use, or
  recovery time demonstrates that PostgreSQL no longer fits.

The supporting trade-off and primary sources are recorded in
[ATTACH-01 file-upload and download research](../research/attach-01-file-upload-best-practices.md).
