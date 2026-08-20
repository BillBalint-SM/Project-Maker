---
status: accepted
---

# Store bounded ATTACH-01 content in PostgreSQL first

ATTACH-01 will store its first-release immutable file bytes in a dedicated
PostgreSQL `bytea` content table behind the attachment repository seam. With a
default 50 MiB per-file cap, bounded concurrency, and aggregate byte ceilings,
this keeps metadata, relationships, bytes, transactional commit, backup, and
restore inside the platform's one existing durable boundary; introducing object
storage now would add credentials, cross-system consistency, backup, and recovery
work before measured need. The per-file cap is configurable downward. There is
no per-owner attachment-count or byte maximum; the default capacity ceilings are
2 GiB per Project, 10 GiB across retained Question Bank content, and 20 GiB
across the deployment.

## Consequences

- Uploads spool, inspect, hash, and scan outside a database transaction; only
  verified bounded bytes and their relationship commit together.
- PostgreSQL may materialize a whole TOASTed value, so concurrency is capped and
  delivery is blocked unless the documented latency, memory, WAL, dump, and
  restore gates pass.
- Object storage is the replacement adapter when measured evidence fails those
  gates or later scale requires it. That change must preserve parent-scoped
  authorization, idempotency, integrity, and recovery semantics.
- Content is never deduplicated across Projects. Unchanged immutable Question
  Bank relationships may reuse the same content record.

The supporting trade-off and primary sources are recorded in
[ATTACH-01 file-upload and download research](../research/attach-01-file-upload-best-practices.md).
