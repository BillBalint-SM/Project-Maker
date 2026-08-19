# Microsoft 365 correspondence channel

> **Transitional implementation:** this runbook records the currently delivered
> Microsoft Graph transport. [ADR 0003](adr/0003-use-operator-provided-mail-gateway.md)
> makes an Operator organization-provided SMTP/IMAP gateway the target
> architecture. Do not present this runbook as the target activation model.

This runbook provisions and proves Project Maker's dedicated Microsoft 365
Customer communication channel. It is an operator procedure for a controlled,
non-production test environment. A green fake-Graph build is necessary
regression evidence, but it is not production-readiness evidence.

## Delivery and Operator organization activation ownership

The application, provider boundary, migrations, regression evidence, wizard,
and this runbook form the supplier delivery. They can be reviewed and deployed
without giving the supplier access to the Operator organization's tenant. Missing Microsoft
365 configuration stays fail-closed and does not block unrelated Project Maker
work.

Tenant activation is a separate Operator organization-operated release gate:

- the Operator organization's Entra administrator registers the application, uploads the
  public certificate, and grants tenant-admin consent for `Mail.Send`;
- the Operator organization's Exchange administrator creates and proves the dedicated-
  mailbox-only `Application Mail.Read` scope;
- the Operator organization's deployment secret owner generates and retains the private key
  and injects the runtime values in the target environment;
- the Operator organization's operator runs the controlled smoke and records only the
  redacted evidence described below.

The supplier must not receive tenant-admin access, mailbox access, the private
key, access tokens, Project Customer mail, or a populated `.env`. An Operator organization maintainer
may contribute the completed evidence-only change, or provide its bounded
non-secret fields to the repository maintainer for that single change. Until
the evidence verifier passes, describe the feature as delivered and tenant-
ready, not production-activated.

## Authority and security boundary

The Entra application is single-tenant and authenticates with a certificate,
not a client password. Keep the private PEM key in the deployment secret store;
the repository and retained logs may contain neither the key nor its base64
representation. Microsoft recommends certificate credentials for production
confidential applications and requires only the public certificate to be
uploaded to the app registration. See Microsoft's
[certificate credential](https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials)
and [credential management](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)
guidance.

The permission model is deliberately asymmetric:

- grant Microsoft Graph application `Mail.Send` with tenant-admin consent so
  the application can submit from the dedicated mailbox and an employee-entered
  exact `@pte.hu` mailbox;
- grant `Application Mail.Read` in Exchange Online Application RBAC with a
  resource scope that selects only the dedicated correspondence
  mailbox;
- do not grant unscoped `Mail.Read` in Entra. Entra permission grants and
  Exchange Application RBAC grants are additive, so an unscoped Entra grant
  would defeat the mailbox restriction;
- never grant Project Maker read access to a PO/PM personal mailbox.

Microsoft documents the current resource-scoped model in
[RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).
Its `Test-ServicePrincipalAuthorization` command must show the dedicated
mailbox in scope and a different mailbox out of scope before rollout.

## Values and destinations

Run `scripts/setup-m365-channel.ps1` from PowerShell after copying
`.env.example` to `.env`. The wizard opens the relevant administration pages,
captures values without displaying the private key, and writes only to the
local `.env` file.

| Value | Source | Classification | Destination |
| --- | --- | --- | --- |
| Directory tenant ID | Entra app overview | public operational identifier | `.env` `GRAPH_TENANT_ID` |
| Application client ID | Entra app overview | public operational identifier | `.env` `GRAPH_CLIENT_ID` |
| Enterprise app service-principal Object ID | Entra Enterprise applications | public operational identifier | wizard memory only for Exchange RBAC |
| Certificate SHA-1 thumbprint | Entra Certificates page | public operational identifier | `.env` `GRAPH_CLIENT_CERTIFICATE_THUMBPRINT` |
| Base64-encoded PEM private key | deployment secret owner | secret | `.env` `GRAPH_CLIENT_PRIVATE_KEY_BASE64` only |
| Dedicated mailbox name and base address | Exchange administrator | public runtime configuration | `.env` `CORRESPONDENCE_MAILBOX_NAME` and `CORRESPONDENCE_MAILBOX_ADDRESS` |

Do not add any of these values to GitHub Actions: the mandatory tenant smoke is
non-CI, and repository CI uses only the controlled Graph fake.

## Provisioning

1. Register a single-tenant Project Maker application in Entra. Record its
   tenant ID, application/client ID, and the Enterprise application's service-
   principal Object ID.
2. Upload only the public certificate through **Certificates & secrets >
   Certificates**. Keep the private key in the approved deployment secret
   destination.
3. Add Microsoft Graph application `Mail.Send` and grant tenant-admin consent.
   A successful Graph `sendMail` response is `202 Accepted`; Microsoft explicitly
   states that this is acceptance for processing, not delivery. Normal
   `sendMail` saves to Sent Items by default where the selected sender has a
   mailbox. See the [sendMail API](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).
4. In Exchange Online PowerShell create the service-principal pointer, a
   management scope selecting only the dedicated mailbox, and an `Application
   Mail.Read` assignment. Use the exact commands shown by the wizard and test
   authorization against both an in-scope and out-of-scope mailbox.
5. In Exchange admin center confirm that plus addressing is not disabled.
   Microsoft describes plus delivery as retrying resolution after removing the
   `+tag` when the full address is not an alias. See
   [Plus Addressing in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/plus-addressing-in-exchange-online).
6. Send a controlled message to
   `<dedicated-local-part>+project-maker-provisioning@pte.hu`. If it does not
   arrive in the dedicated mailbox, stop rollout. Do not replace token
   correlation with subject, body, or conversation inference.
7. Run the wizard, validate Compose configuration with `pnpm compose:config`,
   then start the isolated test deployment. Configuration or authorization
   failure must remain bounded and must not block unrelated Project work.

## Repeatable application regression

Run `pnpm verify` and `pnpm test:e2e` against a uniquely named disposable
loopback PostgreSQL database. Together the current public-boundary tests prove:

- Project-start save/leave, schema-focused continuation, exactly-one Initial
  Intake creation, recovery, and browser history in `project-start.spec.ts`;
- dedicated and exact-`@pte.hu` sender selection, immutable handoff versions,
  ping separation, `FAILED`/`UNKNOWN` recovery, and no-Markdown Customer mail
  in the handoff, ping, and SMTP-boundary API/browser suites;
- mailbox single-flight polling, bounded throttling, delta-cursor recovery,
  exact token correlation, replay idempotency, late replies, archive
  readability/restoration, triage, and manual classification in the mailbox
  sync and Customer correspondence API/browser suites;
- no formal Project decision or Discovery follow-up resolution from message
  classification;
- upgrade from the supported 0016 database baseline while retaining an
  existing Project, handoff, and ping attempt in
  `m365-channel-upgrade-migration.e2e-spec.ts`;
- guarded rollback for retained handoff, ping, delta, inbound-message,
  processing, receipt, and triage evidence in the focused migration suites.

The browser suites run the real Angular application, Nest API, and PostgreSQL,
with only Microsoft Graph replaced at its provider boundary. They are the
repeatable employee-workflow proof; the following tenant smoke proves the
external Microsoft 365 assumptions that fake Graph cannot.

## Controlled Microsoft 365 tenant smoke

Use dedicated test mailboxes, a disposable Project Maker database, and the
exact commit intended for deployment. Never use Customer content. Before the
run, record `git rev-parse HEAD` privately for later placement in the bounded
evidence file.

### Preconditions

- the dedicated mailbox and one different exact `@pte.hu` PO/PM test mailbox
  can send mail;
- one controlled recipient mailbox can reply;
- an Exchange administrator has confirmed one deliberately nonexistent exact
  `@pte.hu` address for the negative-path check;
- the scoped read authorization tests pass for the dedicated mailbox and fail
  for a different mailbox;
- the plus-address provisioning message arrived;
- `pnpm verify` and the complete `pnpm test:e2e` suite are green against a
  disposable loopback PostgreSQL database.

### Positive channel proof

1. Create a synthetic Project, complete its Initial Intake, and prepare an
   Interview customer handoff containing only synthetic text.
2. Preview and send from the dedicated mailbox. Verify the UI reports
   **Átadva a levelezőrendszernek**, the immutable From identity is the
   dedicated mailbox, and Reply-To is a unique plus address at that mailbox.
3. Where the tenant supports the selected sender's Sent Items behavior, verify
   one message appears. Otherwise record `NOT_SUPPORTED`; do not call this a
   delivery failure.
4. Reply from the controlled recipient. Run **Üzenetek frissítése** and verify
   that delta synchronization retains exactly one message in the exact
   correspondence. Refresh again and verify provider replay creates no second
   message or unread increment.
5. Archive the synthetic Project, send a later reply to the same Reply-To,
   refresh, and verify it remains readable while processing actions stay
   blocked. Restore the Project and verify processing resumes without changing
   the retained messages.
6. Prepare a separate synthetic Customer follow-up ping. Send it from the
   different exact `@pte.hu` PO/PM test mailbox. Verify that From remains that
   mailbox while Reply-To remains central, and verify Sent Items where
   supported.
7. Reply to the ping and verify Project Maker opens the referenced Discovery
   follow-up without resolving it or recording a formal Project decision.

### Real Graph rejection and retry safety

1. Create a separate synthetic logical ping using the administrator-confirmed
   nonexistent exact `@pte.hu` sender. Preview and submit it once.
2. Verify Graph rejects the submission with one bounded Project Maker failure
   state. Application output must contain no subject, body, address, reply
   token, access token, attachment name, or raw Graph response.
3. Use the explicit retry once without changing the logical ping. Verify the
   same outbound communication, correspondence, and central Reply-To identity
   are retained and only a new attempt is appended. No message should appear in
   any Sent Items folder.
4. Do not retry again. Correct the sender through a fresh preview only in a new
   controlled logical delivery.

This negative path reaches the real tenant but cannot deliver because the
selected mailbox does not exist. It proves bounded failure and identity-safe
retry without manufacturing an uncertain delivery or accepting duplicate-mail
risk.

### Evidence record

Edit only `docs/evidence/m365-tenant-smoke.json`:

- set `executedAt` to the UTC execution date (`YYYY-MM-DD`);
- set `commit` to the tested 40-character Git commit;
- set `result` to `PASS` only after every required check passes;
- set `sentItemsOutcome` to `OBSERVED` or `NOT_SUPPORTED`;
- set each required check to `true`.

Do not add names, addresses, tenant IDs, message content, identifiers, logs,
free-form notes, or credentials. Then run:

```powershell
pnpm verify:m365-tenant-smoke
```

The verifier rejects templates, partial results, unknown fields, and anything
other than a complete passing controlled-tenant result. The tested commit may
be followed only by a commit that changes this evidence file; any later source
or configuration change invalidates the result. Until this command is green,
the Microsoft 365 channel is not production-ready.

## Polling and recovery

- The default mailbox delta poll is 60 seconds and can be changed with
  `CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS`. Manual refresh joins the same
  durable single-flight path.
- A first connection establishes a baseline without importing historical mail.
  An expired cursor preserves retained messages, rebuilds the baseline, and
  imports messages received after the last successful synchronization.
- Project Maker honors a bounded Graph `Retry-After`; it uses jittered bounded
  retry only when Graph supplies no delay.
- `CONFIGURATION`, `AUTHENTICATION`, throttling/temporary availability, and
  invalid-cursor recovery are distinct operator conditions. Diagnostics remain
  bounded and redacted.
- Never clear retained messages, correspondence, or sync state merely to make
  recovery or rollback pass.

## Certificate rotation

1. Create the replacement certificate and upload only its public key while the
   existing certificate remains valid. Microsoft supports multiple registered
   certificates for overlap.
2. Store the new private key in the approved deployment secret destination and
   update the thumbprint and key together during a controlled restart.
3. Prove token acquisition, one dedicated-mailbox send, and one delta refresh.
4. Only after the controlled checks pass, remove the old public certificate
   from Entra and remove the old private key from its secret store.
5. Record the rotation operationally without copying certificate material,
   mailbox identity, or Customer content into repository evidence.

If the replacement fails, restore the previous thumbprint/private-key pair
while the old public certificate is still registered. Never fall back to a
client password.
