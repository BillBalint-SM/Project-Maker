# Project Maker release and cutover checklist

This checklist separates two independent release gates:

1. deploying Project Maker for internal use on the Operator organization's private network or VPN; and
2. activating the Operator organization's TLS SMTP/IMAP Customer-mail gateway.

The application gate can be completed without activating the mail gateway. Project work remains available; Customer-mail actions stay unavailable or fail closed until the gateway gate is complete.

## Handover package

The receiving Operator organization receives:

- the exact deployment commit and its successful GitHub CI result;
- the [user guide](user-guide.md);
- the [operations handoff](operations-handoff.md), including migration, backup, and restore procedures;
- the [runtime configuration reference](configuration.md);
- the [Operator mail gateway runbook](mail-gateway.md) and the `scripts/setup-mail-gateway.ps1` interactive helper; and
- this decision and sign-off checklist.

A populated `.env`, passwords, private CA material, mailbox contents, and Project Customer data are never part of the handover package.

## Owners and retained evidence

| Owner | Responsibility | Retained non-secret evidence |
| --- | --- | --- |
| Repository owner | Record the deployment commit and successful CI. | Commit SHA and CI link. |
| Network/security owner | Provide private-network or VPN access, HTTPS/TLS, and firewall controls. | Approved internal URL and date. |
| Deployment owner | Apply runtime configuration and start Compose. | Configuration validation and health result. |
| Database owner | Own backup retention and restore verification. | Backup time and restore-drill result. |
| Business acceptor | Validate a synthetic end-to-end Project journey. | Acceptance date and result. |
| Gateway owner | Provide the dedicated mailbox, TLS SMTP/IMAP endpoints, plus-addressing, and network reachability. | Existing internal change record or approval. |
| Secret owner | Inject SMTP/IMAP credentials and optional CA material securely. | Internal secret-location reference, without values. |
| Gateway-smoke operator | Run the controlled real-gateway smoke. | Date, commit, and result in the existing internal change record. |

## Gate 1 — application deployment

### Preconditions

- [ ] The deployment owner has recorded a fixed source commit; deployment does not originate from a moving branch.
- [ ] The commit passed the `checkpoint`, `mail-gateway`, and `container-smoke` GitHub CI jobs.
- [ ] The application is reachable only on the Operator organization's private network/VPN or behind an equivalent firewall and reverse proxy.
- [ ] The external endpoint uses HTTPS and `CORS_ORIGIN` is exactly that origin. Project Maker uses self-service local email/password accounts for Internal users. All active Internal users have the same capabilities: there are no roles or per-Project permissions. The VPN remains the access boundary; public internet exposure is unacceptable.
- [ ] The populated `.env` is in the Operator-approved runtime/secret location, not in Git, tickets, chat, or handover material.
- [ ] Before upgrading an existing database, a verified PostgreSQL backup exists. For a new empty deployment, record this as not applicable.
- [ ] The Operator has assigned owners for backup retention and restore drills.

### Deployment checks

1. In the exact source checkout, run the local equivalents of the three CI gates. `migration:run` and `pnpm verify` must use a dedicated, non-production test database; the other commands own disposable resources.

   ```powershell
   pnpm install --frozen-lockfile
   pnpm --filter @project-maker/api migration:run
   pnpm verify
   pnpm test:mail-gateway
   node scripts/run-container-smoke.mjs
   ```

2. Populate the deployment `.env` according to the [configuration reference](configuration.md), then validate Compose without printing its contents:

   ```powershell
   pnpm compose:config
   ```

3. For an upgrade with retained data, create a backup using the [PostgreSQL backup procedure](operations-handoff.md#postgresql-backup), then start the stack:

   ```powershell
   pnpm compose:up
   ```

4. Verify the internal HTTPS application URL and the proxied `/api/health` endpoint.
5. Inspect migration status using the [documented running-container command](operations-handoff.md#database-migrations-and-recovery). `pending: false` and all 39 migrations through `0039` are required.
6. With synthetic data, complete this business smoke: create a Project and exit it; return to Portfolio; accept a question schema; save an assessment answer; close the assessment; open Estimation Readiness; create a clarification item; open Project Status; and return precisely to the originating list.
7. At a supported desktop width of at least 1024 pixels, verify keyboard navigation, global and Project navigation, the primary task, and retry after an error.

### Gate 1 outcome

The application may be handed over for business use when every item above passes. If Gate 2 is not complete, record:

> The application is live; Project Customer communication becomes available in production after the Operator organization's mail gateway is activated.

## Gate 2 — Customer-mail gateway activation

Only the Operator organization's gateway, secret, and operations owners may complete this gate. The supplier does not receive mailbox access, passwords, private CA material, or a populated `.env` file.

- [ ] The gateway owner created or selected the dedicated correspondence mailbox and proved that plus-addressed replies arrive in the same inbox.
- [ ] SMTP and IMAP use only `STARTTLS_REQUIRED` or `IMPLICIT_TLS`; the certificate chain is trusted and TLS 1.2 or later is required.
- [ ] SMTP and IMAP credentials are maintained independently in the approved secret store; plaintext, downgrade, and fallback modes are not enabled.
- [ ] The local configuration helper completed without displaying secrets and `pnpm compose:config` succeeds.
- [ ] The configured dedicated identity is the actual SMTP envelope and `From` sender; personal or alternate senders are not allowed.
- [ ] The [controlled gateway smoke](mail-gateway.md#controlled-gateway-smoke) passes all send, Reply-To, IMAP, deduplication, error, and TLS checks.
- [ ] The run date, deployment commit, and result are recorded in the existing internal change record without secrets or Project Customer data.

## Go / no-go decision

### Go — application

- every Gate 1 check passed;
- the private-network/VPN and HTTPS boundary is evidenced;
- an existing-data deployment has a verified backup and restore owner;
- health, migrations, and the synthetic Project journey passed; and
- the mail-gateway status is communicated accurately until Gate 2 is closed.

### Go — Customer-mail gateway

- Gate 1 is in Go state;
- plus-addressing, separate credentials, and TLS constraints are evidenced; and
- the controlled gateway smoke result belongs to the deployed commit.

### No-go

- public or uncontrolled network exposure bypassing the VPN boundary;
- no verified backup before an existing-data upgrade;
- failed health check or pending/failed migration;
- first testing with real Project Customer data;
- claiming the gateway is active without a documented successful smoke; or
- weakening TLS verification, failed plus-addressing, or a personal/alternate sender.

## Recovery and rollback

1. Stop web and API writes; do not remove the PostgreSQL volume.
2. Record the incident time and deployed commit without secrets or Project Customer data.
3. For data loss or migration issues, restore the verified backup through the [controlled restore procedure](operations-handoff.md#controlled-restore). Do not delete data to force a guarded migration rollback.
4. For an application regression, use the previously recorded source/artifact together with its compatible database recovery plan; never build a rollback from a moving branch.
5. For a gateway incident, stop using mail functions and revoke or rotate the required SMTP/IMAP credential in the secret store. Do not delete retained correspondence, checkpoints, or the database volume.
6. Before reopening, repeat health, migration, and relevant gateway-smoke checks.

## Handover record

| Field | Value |
| --- | --- |
| Deployed commit | |
| CI run | |
| Environment and internal HTTPS URL | |
| Database backup / new-installation marker | |
| Restore-drill result | |
| Application-smoke date and result | |
| Business acceptor | |
| Gateway status: `NOT ACTIVATED` / `ACTIVATED` | |
| Gateway-smoke commit, date, and result | |
| Open operational limitation | |

Do not enter secrets or personal values in this record.
