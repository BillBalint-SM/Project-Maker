# Runtime configuration reference

This is the authoritative environment-variable reference for a Project Maker
deployment. Start from [`.env.example`](../.env.example), keep the populated
environment file in the Operator organization's approved secret location, and
never commit or paste its real values into tickets, chat, logs, or handover
material.

The Docker Compose stack reads the selected environment file. Validate its
shape without printing it with:

```powershell
pnpm compose:config
```

## Required base configuration

| Variable | Required | Requirements and effect |
| --- | --- | --- |
| `POSTGRES_DB` | Yes | PostgreSQL database name used by the Compose database service. |
| `POSTGRES_USER` | Yes | PostgreSQL application user. |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL application password. It must match the password encoded in `DATABASE_URL`. |
| `DATABASE_URL` | Yes | Exact `postgres://` or `postgresql://` connection URL for the API. It must be a valid URL with no leading or trailing whitespace. In Compose it normally addresses the `postgres` service. |
| `WEB_PORT` | Yes | Host port published by the Nginx web service, which listens internally on `8080`. |
| `CORS_ORIGIN` | Yes | One exact HTTP or HTTPS browser origin, for example `https://project-maker.internal`. Paths, wildcards, credentials, query strings, fragments, and origin lists are rejected. |

## Customer-response and Git handoff configuration

| Variable | Required | Requirements and effect |
| --- | --- | --- |
| `CUSTOMER_RESPONSE_ORIGIN` | Yes | Exact public-facing origin used when the application creates Customer response links. It must match the browser origin that serves the response route. |
| `CUSTOMER_RESPONSE_PREVIEW_SECRET` | Yes | Secret used to bind Customer response previews and confirmations. Use at least 32 unpredictable characters. |
| `GIT_CREDENTIAL_ENCRYPTION_KEY` | Yes | Application key used to encrypt retained shared Git setup credentials at rest. It must contain at least 32 characters. Changing it makes previously stored credentials unreadable until their setups are updated. |
| `GIT_HANDOFF_PREVIEW_SECRET` | Yes | Secret used to bind Git handoff previews and confirmations. Use at least 32 unpredictable characters. |

## Workflow and attachment limits

| Variable | Required | Default | Requirements and effect |
| --- | --- | --- | --- |
| `FOLLOW_UP_POLL_INTERVAL_MS` | No | `60000` | Integer interval for the automatic Customer follow-up worker. Accepted range: `5000` to `86400000` milliseconds. Invalid values prevent API startup. |
| `ATTACHMENT_MAX_MIB` | No | `50` | Whole-number maximum for one Question Bank reference file or Project work attachment. Accepted range: `1` to `50`; the deployment may reduce but cannot increase the 50 MiB hard limit. Invalid values prevent API startup. |
| `CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS` | No | `60000` | Scheduled IMAP synchronization interval. A non-integer, value below `100`, or value above `2147483647` falls back to `60000` milliseconds. |

## Customer-mail gateway

All variables in this section describe the Operator organization's dedicated
correspondence mailbox. The runtime accepts only complete, safe TLS SMTP and
IMAP configuration. If any required mail value is missing, partial, or invalid,
mail operations remain unavailable or fail closed; unrelated Project Maker
work continues. There is no plaintext or fallback mail transport.

| Variable | Required for mail | Default | Requirements and effect |
| --- | --- | --- | --- |
| `CORRESPONDENCE_MAILBOX_NAME` | Yes | — | Display name for the dedicated sender identity. It must be non-empty, at most 255 characters, and contain no CR, LF, or NUL characters. |
| `CORRESPONDENCE_MAILBOX_ADDRESS` | Yes | — | Dedicated sender address. It must be a non-empty, single email-shaped address without CR, LF, or angle brackets. |
| `MAIL_GATEWAY_SMTP_HOST` | Yes | — | SMTP host name. It must be non-empty, at most 253 characters, and must not contain a scheme, slash, backslash, or `@`. |
| `MAIL_GATEWAY_SMTP_PORT` | Yes | `587` for `STARTTLS_REQUIRED`; `465` for `IMPLICIT_TLS` | Integer TCP port from `1` through `65535`. |
| `MAIL_GATEWAY_SMTP_SECURITY` | Yes | `STARTTLS_REQUIRED` | Exactly `STARTTLS_REQUIRED` or `IMPLICIT_TLS`. Opportunistic TLS and plaintext are not supported. |
| `MAIL_GATEWAY_SMTP_USERNAME` | Yes | — | Non-empty SMTP account name. |
| `MAIL_GATEWAY_SMTP_PASSWORD` | Yes | — | Non-empty SMTP secret. |
| `MAIL_GATEWAY_IMAP_HOST` | Yes | — | IMAP host with the same host validation rules as SMTP. |
| `MAIL_GATEWAY_IMAP_PORT` | Yes | `143` for `STARTTLS_REQUIRED`; `993` for `IMPLICIT_TLS` | Integer TCP port from `1` through `65535`. |
| `MAIL_GATEWAY_IMAP_SECURITY` | Yes | `IMPLICIT_TLS` | Exactly `STARTTLS_REQUIRED` or `IMPLICIT_TLS`. |
| `MAIL_GATEWAY_IMAP_USERNAME` | Yes | — | Non-empty IMAP account name. Use a separately managed credential even where the provider permits the same value as SMTP. |
| `MAIL_GATEWAY_IMAP_PASSWORD` | Yes | — | Non-empty IMAP secret. |
| `MAIL_GATEWAY_IMAP_FOLDER` | No | `INBOX` | Folder to synchronize. It must be at most 255 characters and contain no CR, LF, or NUL characters. |
| `MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64` | No | empty | Optional base64-encoded PEM CA certificate for a private trust chain, shared by both TLS channels. When set, it must decode to exactly one PEM certificate. |

The mail transport uses a fixed 10-second operation timeout. Configuration,
authentication, TLS, or provider diagnostics are deliberately bounded so that
credentials and provider details are not written to application logs.

For gateway ownership, controlled verification, inbox baseline behaviour, and
credential rotation, see the [Operator mail gateway runbook](mail-gateway.md).
