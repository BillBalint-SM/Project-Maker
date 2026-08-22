# ATTACH-01 file upload and download: implementation evidence

**Historical scope.** This note records the primary-source cross-check considered while finalizing the [ATTACH-01 implementation plan](../attach-01-governed-discovery-attachments.md). It is design history, not a description of the current runtime and not a backlog of implicit requirements. The delivered design and ADR-0005 are authoritative where this research explored a broader option.

## Outcome

The pre-final design had the right product boundary and most important controls: bounded types and sizes, server-verified type/signature, generated identifiers, scan-before-commit, parent-scoped authorization, immutable relationships, `attachment` downloads, PostgreSQL backup/restore, and no browser rendering. These agree with OWASP's defence-in-depth upload guidance: allowlist only business-needed types, do not trust client media types, generate storage names, limit size, authorise both upload and access, scan content, and protect downloads ([OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

The changes below make the delivery operationally unambiguous: hard multipart limits at every boundary, one bounded streaming spool/scan/commit path, retry-safe idempotency, scanner readiness, and explicit recovery/telemetry tests.

## Secure, bounded upload pipeline

1. **Reject early and at more than one layer.** Nginx must allow only the configured file limit plus small documented multipart overhead, while the API enforces the exact file-byte cap independently; Nginx defaults `client_max_body_size` to only 1 MiB ([Nginx core request-body limit](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size)). The route must accept exactly one known file field and set explicit multipart limits for `fileSize`, `files`, `fields`, `fieldSize`, and field-name length. Multer defaults several limits to infinity; its own documentation recommends explicit limits to reduce DoS exposure and warns that memory storage holds the entire file in RAM ([Multer limits and memory-storage warning](https://expressjs.com/en/resources/middleware/multer/)). Nest's built-in `MaxFileSizeValidator`/`FileTypeValidator` are useful metadata/magic-number gates, but are not a replacement for the business policy and scanner ([Nest file upload](https://docs.nestjs.com/techniques/file-upload)).

2. **Use disk-spooled, request-scoped streaming, never `memoryStorage()`.** Stream the multipart body once to a private, random, non-web-served temp file while counting bytes and calculating SHA-256. Pipeline errors, request abort, timeout, signature/type mismatch, quota failure, scanner error, and database error must close descriptors and schedule deletion. Node's `pipeline()` applies backpressure so a slower destination does not allow unbounded buffering; an `AbortSignal` destroys its pipeline on cancellation ([Node streams](https://nodejs.org/api/stream.html)).

3. **Apply a strict allowlist after canonical filename processing.** Keep the existing extension + declared-type + magic-signature agreement. Decode/normalise before extension inspection; reject ambiguous/double extensions, path separators, controls, empty files, archives, encrypted/unscannable files, active content, and macro-enabled Office formats. Neither a client `Content-Type` nor a signature is individually trustworthy ([OWASP upload validation](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)). Exclude legacy `.doc`, `.xls`, and `.ppt` from the first allowlist: Microsoft documents that legacy `.doc`/`.xls` can contain VBA while modern macro-disabled `.xlsx` cannot store VBA or Excel 4.0 macro sheets ([Microsoft Office format reference](https://learn.microsoft.com/en-us/office/compatibility/office-file-format-reference)). The 50 MiB product cap remains bounded when ingress overhead is explicit, the API independently enforces the exact configured file cap, and the scanner accepts at least that cap.

4. **Scan the exact spooled bytes before durable availability.** A local ClamAV Unix socket should receive an `INSTREAM` scan (or `FILDES` where supported), never a path exposed over TCP. `clamd`'s TCP protocol provides neither encryption nor authentication; `INSTREAM` has a separate `StreamMaxLength`, which must be at least ATTACH-01's application cap so every otherwise valid file can be scanned, while the application remains the authoritative smaller limit ([ClamAV protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)). Treat `FOUND`, malformed/unscannable, timeout, unavailable scanner, and an out-of-date/unhealthy scanner as a failure: do not create content or a relationship, reveal no signature/engine diagnostics, and show a safe, actionable professional-English error. A health/readiness check must verify `PING`, scanner configuration limits, and signature freshness before accepting uploads.

5. **Commit one short transaction only after scanning.** Re-check owner lifecycle/version and the applicable Project, Question Bank, and deployment aggregate byte quotas under a row lock or serializable transaction; there is no per-owner attachment-count or byte quota. Insert immutable content + typed relationship + audit outcome together, then delete the temp file. PostgreSQL serializable transactions can abort on a serialization failure, so retry the *database transaction* safely a small bounded number of times, not the scan or the client request ([PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)). A client disconnect before the final response must not make a partial body available.

6. **Make client retries idempotent.** Add an owner-scoped `Idempotency-Key` to upload requests and persist its request fingerprint (owner, declared safe filename, size, SHA-256) with the successful relationship/result. Repeating that key and fingerprint returns the original summary; a changed fingerprint with the same key is rejected; an in-progress key has a bounded retry/status response. This fixes the important “commit succeeded but response was lost” case without deduplicating content between Projects. Keep one new key for an intentional second upload. The final ATTACH-01 plan adopts this behavior and extends the mutation receipt to Question Bank replace, reorder, and remove commands.

## Storage, integrity, concurrency, and recovery

The existing PostgreSQL `bytea` decision is appropriate for a bounded 50 MiB per-file maximum and an internal, low-volume first release because relationship and bytes can be backed up/restored as one durable unit. PostgreSQL transparently stores oversized variable-length values out of line through TOAST ([PostgreSQL TOAST](https://www.postgresql.org/docs/current/storage-toast.html)). It is not a claim that BLOB storage is universally fastest: measure database size, WAL/backup duration, restore RTO, read latency, and concurrent download pressure before revisiting the hidden repository seam. OWASP also identifies database storage as a valid option with backup/permission advantages but a performance/capacity trade-off ([OWASP storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

Retain the SHA-256 as integrity evidence, but define verification precisely: hash the spooled stream; verify the bytes read for the database write match that digest before inserting the available relationship; on supported backup/restore drills, retrieve and hash representative retained content. A background integrity verifier should cover all stored content on a documented cadence and quarantine/alert on mismatch. Do not use digest equality for cross-Project deduplication or existence decisions.

Use foreign keys, owner-scoped idempotency uniqueness, aggregate byte-quota checks, and an explicit lifecycle/version predicate. This preserves the accepted rule that Question Bank publication rejects an obsolete version and that resolution races are either committed-before-resolution or rejected-after-resolution. Never hold an owner database transaction open while receiving or malware-scanning a file. A serializable failure is an expected conflict result after the bounded server retry, not a silent last-writer-wins result.

Temporary storage needs a dedicated private directory/volume, least privilege, unpredictable names, a maximum sweep age, and a startup reconciliation job. The job must delete only files bearing the module's generated naming/prefix and report count/age/error metrics; it must never traverse an arbitrary caller path. Infected/rejected temporary bytes are deleted, not retained as an application quarantine; the scanner's own operational quarantine policy is separate.

For recovery, PostgreSQL custom/directory archives are appropriate because `pg_dump`/`pg_restore` support portable selective restore; custom and directory formats are compressed, and directory format supports parallel dumps ([PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)). The release gate should require a timed restore drill that checks metadata, relationship reachability, and SHA-256 on sample bytes—not merely that `pg_restore` exits successfully.

## Safe, fast download

Every download remains parent-scoped and re-authorises the owner at request time. PostgreSQL may materialize a whole TOASTed value rather than expose partial streaming, so bound download concurrency and pipe the bounded result to the response with backpressure; PostgreSQL documents that most operations on TOASTed fields read or write the whole value ([PostgreSQL large-object introduction](https://www.postgresql.org/docs/current/lo-intro.html)). Send the stored verified MIME type, exact `Content-Length`, `Content-Disposition: attachment; filename="safe-ascii"; filename*=UTF-8''…`, and `X-Content-Type-Options: nosniff`. `attachment` triggers download instead of inline rendering and `filename*` supports UTF-8 names ([MDN Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition)); `nosniff` prevents browsers reinterpreting served content ([MDN X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)). Do not redirect to a storage URL or accept a caller-supplied filename in headers.

Do **not** implement byte ranges in the first delivery. The 50 MiB cap and bounded download concurrency keep full downloads predictable, while ranges add conditional/partial-response semantics (`206`, `Content-Range`, `If-Range`) that require separate authorization, integrity, and test coverage ([MDN range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)). Add ranges only after measured user need.

## Browser experience and accessibility

Use native labelled `<input type="file">` and button/download-link controls as the baseline; drag-and-drop is enhancement only. Upload with `FormData`/`multipart/form-data` ([MDN FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)). Use `XMLHttpRequest.upload` for accurate browser upload progress; it exposes upload progress events, whereas this plan must not promise Fetch upload progress ([MDN XMLHttpRequest upload](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload)). Provide an explicit Cancel action with `AbortController`/request abort and immediately reconcile the list because cancellation can race a successful server commit ([MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)).

Announce meaningful milestones—selected, uploading, scanning, completed, rejected, canceled—through a polite live status region; associate the progress bar's label/value with it. W3C documents this exact file-upload pattern and warns that changing `progressbar` values alone is not announced ([WAI ARIA25](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25)). Validation errors need clear repair guidance and programmatic association with the input; use an alert only for important errors and do not steal focus except when it is needed to act ([WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)). Throttle spoken progress updates (for example, percentage milestones) rather than announcing every byte event.

## Operations, privacy, and verification

Record structured, redacted events and metrics: upload started/outcome class, bytes bucket, duration, scanner latency/outcome class, temporary-cleanup failure, quota rejection, download count/latency, and integrity/recovery result. Alert on scanner unavailable/stale, cleanup backlog, rejection spikes, storage/WAL/backup growth, and integrity mismatch. Do not log bytes, raw filenames, paths, scanner diagnostic text, request bodies, Customer data, or credentials. OWASP explicitly calls out file uploads as security-relevant events and requires sensitive data to be excluded/masked and all event data sanitized ([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

Required test additions to the accepted list:

- Multipart boundary tests: oversized `Content-Length`, chunked body overrun, unexpected field, too many fields/files, abort during transfer, and no memory-buffer storage.
- Scanner adapter contract tests: clean, EICAR detection, timeout, malformed reply, `StreamMaxLength`, unavailable/stale scanner, and no durable row/temp residue. EICAR provides a safe industry test file specifically for anti-malware response testing ([EICAR test file](https://www.eicar.org/download-anti-malware-testfile/)).
- Idempotency tests: replay after lost response returns one relationship; same key/different file rejects; concurrent same-key requests produce one result; different keys remain separate attachments subject only to the applicable aggregate byte quotas.
- Download tests: UTF-8 and hostile names, exact headers/bytes, no inline rendering, parent re-authorisation, archived/resolved read-only access, and no range support.
- Operational tests: startup sweep only deletes owned stale temp files; scanner readiness failure blocks upload; a real backup/restore drill verifies bytes and digests; load test demonstrates bounded memory and scanner/database concurrency.

## Research recommendations considered for ATTACH-01

The list below records the broader recommendations evaluated at design time. It
does not claim that every item was delivered. The current boundary is defined by
the [delivered ATTACH-01 design](../attach-01-governed-discovery-attachments.md),
[ADR-0005](../adr/0005-store-bounded-attachments-in-postgresql.md), and the
runtime source.

1. A default 50 MiB per-file maximum configurable downward, no per-owner count or byte maximum, and default 2 GiB Project, 10 GiB retained Question Bank, and 20 GiB deployment byte ceilings.
2. Explicit Nginx plus Multer route limits, one accepted multipart file field, disk storage only, request timeout, and bounded scanner/database concurrency.
3. A private Unix `clamd` socket, `INSTREAM`, `StreamMaxLength >= upload max`, readiness checks, and fail-closed unavailable, timeout, malformed, limit-exceeded, or stale outcomes.
4. Owner-scoped idempotency keys and persisted mutation-fingerprint/result rules for retry after an indeterminate client response.
5. Integrity verification at durable write, restore drill, and a scheduled verifier, with mismatch download blocking and alert behavior.
6. Private temp-directory ownership, deletion retry/sweep, maximum age, startup reconciliation, and observability.
7. Safe ASCII plus UTF-8 `filename*` download names, no storage redirects, no byte ranges in v1, and per-request parent authorization.
8. Boundary, scanner, idempotency, load, cleanup, and timed recovery tests, with source bytes, filenames, scanner detail, Project Customer material, and secrets excluded from logs.
9. An authenticated Internal-user identity, origin/session controls, and rate limits at the boundaries they protect. This capability is delivered; the VPN limits reachability while local identity binds the actor, without introducing roles or per-Project permissions.

## Sources consulted

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Nginx core request-body limit](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size) and [proxy request buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering)
- [NestJS file upload](https://docs.nestjs.com/techniques/file-upload) and [Multer](https://expressjs.com/en/resources/middleware/multer/)
- [Node.js streams](https://nodejs.org/api/stream.html)
- [ClamAV clamd protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)
- [PostgreSQL TOAST](https://www.postgresql.org/docs/current/storage-toast.html), [large-object introduction](https://www.postgresql.org/docs/current/lo-intro.html), [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), and [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Microsoft Office file-format reference](https://learn.microsoft.com/en-us/office/compatibility/office-file-format-reference)
- [MDN FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [XMLHttpRequest upload](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition), and [`nosniff`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)
- [W3C WAI ARIA25 upload-progress technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25) and [WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
- [EICAR anti-malware test file](https://www.eicar.org/download-anti-malware-testfile/)
