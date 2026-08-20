import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const verifierPath = resolve('scripts/verify-mail-gateway-smoke.mjs');

describe('mail gateway smoke evidence verifier', () => {
  it('accepts one complete redacted controlled-gateway result', () => {
    const result = runVerifier(completeReport());
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'Mail gateway smoke verified: PASS on 2026-08-20.');
  });

  it('rejects templates and identity-bearing fields', () => {
    const report = completeReport();
    report.result = 'NOT_RUN';
    report.host = 'smtp.example.test';
    const result = runVerifier(report);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /only the approved redacted fields/);
  });

  it('rejects a partial result', () => {
    const report = completeReport();
    report.checks.imapReplyDetected = false;
    const result = runVerifier(report);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must be explicitly true/);
  });

  it('retains validity after an evidence-only commit but rejects later source changes', () => {
    const repository = createEvidenceRepository();
    try {
      assert.equal(runVerifier(completeReport(repository.sourceCommit), repository.path).status, 0);
      writeFileSync(join(repository.path, 'application.txt'), 'changed\n', 'utf8');
      git(repository.path, ['add', 'application.txt']);
      git(repository.path, ['commit', '-m', 'change application']);
      const result = runVerifier(completeReport(repository.sourceCommit), repository.path);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /does not match the checked-out commit/);
    } finally {
      rmSync(repository.path, { recursive: true, force: true });
    }
  });
});

function runVerifier(report, repository = resolve('.')) {
  const directory = mkdtempSync(join(tmpdir(), 'project-maker-mail-gateway-smoke-'));
  const reportPath = join(directory, 'result.json');
  try {
    writeFileSync(reportPath, JSON.stringify(report), 'utf8');
    return spawnSync(process.execPath, [verifierPath, reportPath], { cwd: repository, encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function completeReport(commit = currentCommit()) {
  return { schemaVersion: 1, environment: 'CONTROLLED_NON_CI_GATEWAY', executedAt: '2026-08-20', commit, result: 'PASS', checks: {
    smtpTlsSubmissionAccepted: true, dedicatedSenderIdentityPreserved: true, replyToPreserved: true,
    imapInboxBaselineEstablished: true, imapReplyDetected: true, exactCorrelationRetained: true,
    replayDeduplicated: true, boundedRedactedFailureVerified: true, tlsVerificationEnforced: true,
    fakeGatewayInsufficientAcknowledged: true,
  } };
}

function currentCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve('.'), encoding: 'utf8' }).trim();
}

function createEvidenceRepository() {
  const path = mkdtempSync(join(tmpdir(), 'project-maker-mail-gateway-evidence-repo-'));
  git(path, ['init']); git(path, ['config', 'user.email', 'test@example.test']); git(path, ['config', 'user.name', 'Project Maker test']);
  writeFileSync(join(path, 'application.txt'), 'source\n', 'utf8'); git(path, ['add', 'application.txt']); git(path, ['commit', '-m', 'source']);
  const sourceCommit = git(path, ['rev-parse', 'HEAD']).trim();
  const evidenceDirectory = join(path, 'docs', 'evidence'); mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(join(evidenceDirectory, 'mail-gateway-smoke.json'), '{}\n', 'utf8'); git(path, ['add', 'docs/evidence/mail-gateway-smoke.json']); git(path, ['commit', '-m', 'record evidence']);
  return { path, sourceCommit };
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
