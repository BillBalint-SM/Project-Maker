# Gates: canonical Customer-mail persistence

Scope: Interview handoff and Customer follow-up remain separate domains while sharing outbound/attempt persistence and a simple checkpoint.

- [x] G1: One outbound communication and append-only attempt history represent each logical Customer send without parallel outcome copies.
  EVIDENCE: 2026-08-22 — new handoff and follow-up writes use the same small `customer-outbound-persistence` seam; workflow rows keep only their own state, while canonical attempts keep outcome, failure, and timestamp. Incomplete historical snapshots remain read-only fallbacks.

- [x] G2: Retry preserves correspondence/reply identity; a new version receives a new identity; UNKNOWN remains distinct and is never retried automatically.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/api test:mail-gateway
  EXPECT: fail 0
  EVIDENCE: $ pnpm test:compile && node --test --test-concurrency=1 ./dist-test/test/customer-mail-identity.spec.js ./dist-test/test/mail-gateway.config.spec.js ./dist-test/test/mail-gateway-checkpoint.spec.js ./

- [x] G3: The IMAP UID/UIDVALIDITY checkpoint is validated PostgreSQL data; MAIL_GATEWAY_CHECKPOINT_SECRET is not a runtime requirement.
  CHECK: node -e "const {execFileSync}=require('node:child_process');try{const s=execFileSync('rg',['-n','MAIL_GATEWAY_CHECKPOINT_SECRET','apps','compose.yaml','.env.example','.github','docs'],{encoding:'utf8'});console.error(s);process.exit(1)}catch(e){if(e.status===1)console.log('checkpoint-secret-removed');else throw e}"
  EXPECT: checkpoint-secret-removed
  EVIDENCE: checkpoint-secret-removed

- [x] G4: The forward migration retains handoff, ping, attempt, correspondence, correlation identity, and inbound relationships.
  EVIDENCE: 2026-08-22 — the dedicated 0031 -> 0032 PostgreSQL proof passes 1/1 and covers linked revision chains, an incomplete pre-0017 handoff, linked/unlinked follow-ups, legacy fallback, safe checkpoint reset, and retained inbound/triage records. It exposed and then proved the fix for a real constraint-order defect.

- [x] G5: A missing mail gateway still does not block non-mail Project work, and sensitive data does not reach logs.
  EVIDENCE: 2026-08-22 — mail configuration still yields optional `null` for a missing or partial gateway; config/module and redacted-audit boundary tests pass within the 72/72 set, and no credential value entered runtime output.
