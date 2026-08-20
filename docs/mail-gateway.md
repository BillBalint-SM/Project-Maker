# Operator mail gateway

Project Maker sends Project Customer communication through the Operator
organization's dedicated correspondence mailbox over TLS SMTP and receives
replies from the same mailbox over TLS IMAP. This is the current and only
runtime mail channel. It does not require an identity-provider application,
administrator consent, a client credential, or a fallback transport.

The historical migrations retain their original names and evidence. They do
not describe a supported runtime activation path.

## Ownership and boundaries

The Operator organization supplies and operates the gateway, dedicated mailbox,
network reachability, and deployment secrets. A Project Customer neither owns
nor configures these items. The application always sends with the configured
dedicated correspondence identity; employees cannot select a personal or other
sender. Reply-To remains the correlation address supplied by the
application flow.

The supplier does not receive gateway passwords, checkpoint secrets, private
CA material, mailbox content, or a populated `.env`. Incomplete or unsafe
gateway configuration keeps mail functions closed while unrelated Project Maker
work remains available.

## Required configuration

Copy `.env.example` to `.env`, then run the human-only setup helper:

```powershell
scripts/setup-mail-gateway.ps1
```

The helper writes only the local `.env`; do not commit it or paste it into a
ticket or chat. The gateway supports only `STARTTLS_REQUIRED` and
`IMPLICIT_TLS`, validates the server chain, and requires TLS 1.2 or newer.

| Variable | Purpose |
| --- | --- |
| `CORRESPONDENCE_MAILBOX_NAME` / `CORRESPONDENCE_MAILBOX_ADDRESS` | Operator organization-controlled display and dedicated sender identity. |
| `MAIL_GATEWAY_SMTP_HOST`, `_PORT`, `_SECURITY`, `_USERNAME`, `_PASSWORD` | TLS SMTP submission endpoint and credential. |
| `MAIL_GATEWAY_IMAP_HOST`, `_PORT`, `_SECURITY`, `_USERNAME`, `_PASSWORD`, `_FOLDER` | TLS IMAP inbox endpoint and separately managed credential. |
| `MAIL_GATEWAY_CHECKPOINT_SECRET` | At least 32 random characters for encrypted, mailbox/folder-bound IMAP checkpoints. |
| `MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64` | Optional base64 PEM CA only when the Operator gateway uses a private CA. |

SMTP and IMAP credentials stay separate even when the Operator supplies equal
values. Do not enable plaintext, opportunistic TLS, credential logging, or a
transport fallback.

## Controlled gateway smoke

Run this only in a controlled non-CI environment with a disposable Project
Maker database and synthetic messages. First run the repository checks and
record the exact `git rev-parse HEAD` privately.

1. Validate configuration without printing it: `pnpm compose:config`.
2. Send a synthetic interview handoff. Confirm SMTP accepts it, the dedicated
   sender identity is preserved, and the generated Reply-To is retained.
3. Send a reply to that Reply-To, refresh messages, and confirm IMAP establishes
   its initial baseline then retains exactly one correlated reply. Refresh again
   to prove replay does not duplicate it.
4. Submit one controlled known-rejection case. Confirm the application retains
   only a bounded failure condition—never credentials, addresses, message text,
   protocol transcript, or provider response.
5. Verify the gateway rejects an untrusted server chain or unavailable required
   TLS upgrade. Do not weaken TLS verification to make this pass.

Edit only `docs/evidence/mail-gateway-smoke.json`. It accepts only the date,
tested commit, pass result, and required boolean checks; it accepts no names,
addresses, hosts, identifiers, logs, free text, or secrets.

```powershell
pnpm verify:mail-gateway-smoke
```

The smoke result is valid only for its exact source commit, or for a direct
descendant that changes only that evidence file. A green fake adapter test is
regression evidence, not gateway-activation evidence.

## Polling and recovery

Manual refresh and scheduled polling share one durable IMAP path. The first
connection creates a baseline without importing historical mail. The encrypted
checkpoint binds UIDVALIDITY, mailbox, and folder; a changed UIDVALIDITY is an
invalid cursor, not permission to silently replay history. Retained messages,
correspondence, and checkpoint state are never deleted to force recovery.

SMTP rejection produces a known failed attempt. A disconnect after submission
can produce an unknown outcome and requires explicit duplicate-risk acceptance
after an Operator checks the dedicated mailbox. Neither recovery path retries
automatically.

## Credential and CA rotation

Rotate SMTP and IMAP credentials independently. Update the approved secret
destination, restart in a controlled window, and repeat the smoke checks before
revoking the old credential. When using a private CA, install the replacement
CA bundle in the secret destination before changing the gateway chain and then
repeat the same checks. Keep values and certificate contents out of repository
evidence.
