import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const verifierPath = resolve('scripts/verify-m365-tenant-smoke.mjs');

describe('Microsoft 365 tenant smoke evidence verifier', () => {
  it('accepts one complete redacted controlled-tenant result', () => {
    const result = runVerifier(completeReport());

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'Microsoft 365 tenant smoke verified: PASS on 2026-08-19.',
    );
  });

  it('rejects a template or partial result as production-readiness evidence', () => {
    const report = completeReport();
    report.result = 'NOT_RUN';
    report.executedAt = null;
    report.checks.inboundDeltaDetected = false;

    const result = runVerifier(report);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /incomplete or not a passing controlled-tenant run/);
    assert.equal(result.stdout, '');
  });

  it('rejects free-form or identity-bearing fields instead of retaining sensitive evidence', () => {
    const report = completeReport();
    report.mailboxAddress = 'project-maker@example.test';
    report.notes = 'Customer message text';

    const result = runVerifier(report);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /only the approved redacted fields/);
    assert.equal(result.stdout, '');
  });

  it('rejects evidence produced for a different source commit', () => {
    const report = completeReport();
    report.commit = '0123456789abcdef0123456789abcdef01234567';

    const result = runVerifier(report);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not match the checked-out commit/);
    assert.equal(result.stdout, '');
  });

  it('retains validity after an evidence-only commit without allowing later code changes', () => {
    const repository = createEvidenceRepository();
    try {
      const accepted = runVerifier(completeReport(repository.sourceCommit), repository.path);
      assert.equal(accepted.status, 0, accepted.stderr);

      writeFileSync(join(repository.path, 'application.txt'), 'changed\n', 'utf8');
      git(repository.path, ['add', 'application.txt']);
      git(repository.path, ['commit', '-m', 'change application']);

      const rejected = runVerifier(completeReport(repository.sourceCommit), repository.path);
      assert.equal(rejected.status, 1);
      assert.match(rejected.stderr, /does not match the checked-out commit/);
    } finally {
      rmSync(repository.path, { recursive: true, force: true });
    }
  });
});

function runVerifier(report, repository = resolve('.')) {
  const directory = mkdtempSync(join(tmpdir(), 'project-maker-m365-smoke-'));
  const reportPath = join(directory, 'result.json');
  try {
    writeFileSync(reportPath, JSON.stringify(report), 'utf8');
    return spawnSync(process.execPath, [verifierPath, reportPath], {
      cwd: repository,
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function completeReport(commit = currentCommit()) {
  return {
    schemaVersion: 1,
    environment: 'CONTROLLED_NON_CI_TENANT',
    executedAt: '2026-08-19',
    commit,
    result: 'PASS',
    sentItemsOutcome: 'OBSERVED',
    checks: {
      dedicatedMailboxSubmissionAccepted: true,
      alternatePteSenderSubmissionAccepted: true,
      fromIdentityPreserved: true,
      centralReplyToPreserved: true,
      plusAddressAccepted: true,
      inboundDeltaDetected: true,
      exactCorrelationRetained: true,
      replyRetentionVerified: true,
      duplicateSafeRetryVerified: true,
      boundedRedactedFailureVerified: true,
      fakeGraphInsufficientAcknowledged: true,
    },
  };
}

function currentCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: resolve('.'),
    encoding: 'utf8',
  }).trim();
}

function createEvidenceRepository() {
  const path = mkdtempSync(join(tmpdir(), 'project-maker-m365-evidence-repo-'));
  git(path, ['init']);
  git(path, ['config', 'user.email', 'test@example.test']);
  git(path, ['config', 'user.name', 'Project Maker test']);
  writeFileSync(join(path, 'application.txt'), 'source\n', 'utf8');
  git(path, ['add', 'application.txt']);
  git(path, ['commit', '-m', 'source']);
  const sourceCommit = git(path, ['rev-parse', 'HEAD']).trim();

  const evidenceDirectory = join(path, 'docs', 'evidence');
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(join(evidenceDirectory, 'm365-tenant-smoke.json'), '{}\n', 'utf8');
  git(path, ['add', 'docs/evidence/m365-tenant-smoke.json']);
  git(path, ['commit', '-m', 'record evidence']);
  return { path, sourceCommit };
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
