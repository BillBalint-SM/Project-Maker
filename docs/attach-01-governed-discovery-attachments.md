# ATTACH-01 — governed discovery attachments

## Outcome

Authenticated Internal users can attach and download bounded files where a
Question Bank reference, Initial Intake answer, or Discovery follow-up needs
source material. This is not a general document library and Customer inbound
attachments remain outside this feature.

## Smallest accepted flow

1. The employee selects one or more files on the owning screen.
2. The API validates the authenticated actor, mutable owner, configured size
   limit, allowed extension/media signature, and safe filename.
3. The API stores the bytes and relationship in PostgreSQL in one transaction.
4. The owner screen lists the attachment and provides an authenticated download
   and, while the owner remains editable, a confirmed remove action.

Normal HTTP failure leaves no relationship. A retry may create a duplicate that
the employee can remove; ATTACH-01 does not add a receipt, lease, or generic
idempotency subsystem for this reversible internal action.

## Storage and access

- Reuse the accepted PostgreSQL `bytea` boundary from
  [ADR-0005](adr/0005-store-bounded-attachments-in-postgresql.md).
- Keep one configurable per-file size limit and a small allow-list of business
  document types. Reject empty, executable, HTML/SVG, archive, malformed, or
  mismatched content.
- Store the original display name separately from a generated storage identity.
  Never use user text as a path.
- Download only through the authenticated, owner-scoped API with
  `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and a
  safe filename. There are no public URLs or inline previews.
- Archived Projects are read-only but retained attachments remain downloadable.
  Historical Question Bank and resolved follow-up references remain readable.
- Attachment bytes, filenames, free text, and scanner details do not enter audit
  payloads or ordinary application logs.

## Optional malware scanner

When the Operator deployment already provides a supported antivirus service,
the upload path may scan before storage and reject a positive or inconclusive
result. Scanner integration is configuration, not a prerequisite for ATTACH-01:
the application does not provision ClamAV, require fresh-signature jobs, or block
all uploads merely because no scanner is configured.

The file-type allow-list, inert download behavior, authentication, and size
limits remain mandatory with or without a scanner.

## Dependencies

- `SEC-01` authentication and actor identity must exist before production
  exposure. This does not require roles, per-owner permissions, rate limiting on
  every internal upload mutation, or completion of the whole Trust batch.
- Schema migration and ordinary platform backup cover the retained rows. A
  dedicated timed restore drill, weekly digest job, object-storage benchmark, or
  performance gate is not part of this feature.

## Focused verification

- One API/database path covers successful upload/download/removal and archive
  read-only behavior.
- A small table covers unauthenticated access, excessive size, disallowed or
  mismatched type, unsafe filename, and wrong-Project ownership.
- One browser path uploads, downloads, and removes a representative Hungarian
  filename using keyboard-operable controls.
- If optional antivirus integration is implemented, one adapter check proves a
  clean and a rejected result. No real-scanner CI environment is required.

Do not add a dedicated attachment test platform, load suite, scanner container,
format-specific parser framework, mutation receipt table, resumable upload,
chunking, byte ranges, previews, OCR, indexing, deduplication, or storage adapter
abstraction until an observed requirement makes one necessary.

## Delivery shape

Deliver ATTACH-01 in two coherent slices at most:

1. shared storage/access module plus Question Bank reference ownership;
2. Project attachment ownership on Initial Intake and Discovery follow-ups plus
   the one critical browser flow.

The roadmap changes to `DELIVERED` when those affected paths pass. Unrelated
mail, Portfolio, output, backup-drill, and repository-wide cross-product suites
do not gate delivery.
