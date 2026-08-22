# ATTACH-01 — governed discovery attachments

## Outcome

Authenticated Internal users can attach and download bounded files where a
Question Bank reference, Initial Intake checklist snapshot, or Discovery
follow-up needs source material. This is not a general document library and
Customer inbound attachments remain outside this feature.

Two ownership models remain deliberately separate:

- a **Question Bank reference file** belongs to one Operator organization
  Question Bank question revision in a Published Question Bank version; a
  Project question schema retains that exact selected reference-file set;
- a **Project work attachment** belongs to one Project and one Initial Intake
  checklist snapshot or Discovery follow-up.

The two models share the same validation and PostgreSQL durability policy, but
not an ownership table or API. Question Bank file bytes are reused across copied
question revisions; a Project draft deletion can remove Project work attachments
but never an Operator organization Question Bank reference file.

## Smallest accepted flow

1. The employee selects one file on the owning screen.
2. The API validates the authenticated actor, mutable owner, configured size
   limit, allowed extension/media signature, and safe filename. It accepts PDF;
   Word, RTF, and OpenDocument text; Excel, CSV, and OpenDocument spreadsheets;
   PowerPoint and OpenDocument presentations; UTF-8 TXT and Markdown; PNG and
   JPEG; and Microsoft Project and Visio files.
3. The API stores the bytes and relationship in PostgreSQL in one transaction.
4. The owner screen lists the attachment and provides an authenticated download
   and, while the owner remains editable, a confirmed remove action.

Normal HTTP failure leaves no relationship. A retry may create a duplicate that
the employee can remove; ATTACH-01 does not add a receipt, lease, or generic
idempotency subsystem for this reversible internal action.

## Storage and access

- Reuse the accepted PostgreSQL `bytea` boundary from
  [ADR-0005](adr/0005-store-bounded-attachments-in-postgresql.md).
- Keep one configurable per-file size limit: `ATTACHMENT_MAX_MIB` defaults to
  50 and may only lower the 50 MiB product maximum. Allow `.pdf`, `.doc`,
  `.docx`, `.rtf`, `.odt`, `.xls`, `.xlsx`, `.csv`, `.ods`, `.ppt`, `.pptx`,
  `.odp`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.mpp`, and `.vsdx`. Reject
  empty files and every disallowed or mismatched extension, declared media
  type, or supported file-family signature. Executables, HTML/SVG, and generic
  archives remain outside the allow-list; the first release does not claim
  format-deep parsing.
- Store the original display name separately from a generated storage identity.
  Never use user text as a path.
- Download only through the authenticated, owner-scoped API with
  `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and a
  safe filename. There are no public URLs or inline previews.
- Archived Projects are read-only but retained Project work attachments remain
  downloadable. Historical Published Question Bank versions and Project schemas
  retain readable exact reference-file sets; resolved follow-up references also
  remain readable.
- Attachment bytes, filenames, free text, and scanner details do not enter audit
  payloads or ordinary application logs.

## Optional malware scanner

When the Operator deployment already provides a supported antivirus service,
the upload path may scan before storage and reject a positive or inconclusive
result. Scanner integration is configuration, not a prerequisite for ATTACH-01:
the application does not provision a scanner, require fresh-signature jobs, or
block all uploads merely because no scanner is configured.

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

ATTACH-01 is delivered in two coherent ownership slices:

1. Question Bank reference-file ownership and exact version/schema retention;
2. Project work-attachment ownership on Initial Intake and Discovery follow-ups
   plus the one critical browser flow.

The delivered evidence is the focused attachment API/migration proof and one
representative browser upload/download/remove path. Unrelated mail, Portfolio,
output, backup-drill, and repository-wide cross-product suites do not gate
delivery.
