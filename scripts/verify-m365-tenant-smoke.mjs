import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const evidencePath = 'docs/evidence/m365-tenant-smoke.json';

const expectedChecks = [
  'dedicatedMailboxSubmissionAccepted',
  'alternatePteSenderSubmissionAccepted',
  'fromIdentityPreserved',
  'centralReplyToPreserved',
  'plusAddressAccepted',
  'inboundDeltaDetected',
  'exactCorrelationRetained',
  'replyRetentionVerified',
  'duplicateSafeRetryVerified',
  'boundedRedactedFailureVerified',
  'fakeGraphInsufficientAcknowledged',
];
const expectedFields = [
  'checks',
  'commit',
  'environment',
  'executedAt',
  'result',
  'schemaVersion',
  'sentItemsOutcome',
];

const reportPath = process.argv[2];
if (!reportPath) fail('Usage: node scripts/verify-m365-tenant-smoke.mjs <result.json>');

let report;
try {
  report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
} catch {
  fail('The Microsoft 365 tenant smoke result is missing or is not valid JSON.');
}

if (
  !isRecord(report)
  || Object.keys(report).sort().some((field, index) => field !== expectedFields[index])
  || Object.keys(report).length !== expectedFields.length
) {
  fail('The Microsoft 365 tenant smoke result may contain only the approved redacted fields.');
}

if (
  report?.schemaVersion !== 1
  || report.environment !== 'CONTROLLED_NON_CI_TENANT'
  || report.result !== 'PASS'
  || !/^\d{4}-\d{2}-\d{2}$/.test(report.executedAt ?? '')
  || !/^[a-f0-9]{40}$/.test(report.commit ?? '')
  || !['OBSERVED', 'NOT_SUPPORTED'].includes(report.sentItemsOutcome)
) {
  fail('The Microsoft 365 tenant smoke result is incomplete or not a passing controlled-tenant run.');
}

let checkedOutCommit;
try {
  checkedOutCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  fail('The checked-out Git commit could not be determined.');
}
if (
  report.commit !== checkedOutCommit
  && !isEvidenceOnlyDescendant(report.commit, checkedOutCommit)
) {
  fail('The Microsoft 365 tenant smoke evidence does not match the checked-out commit.');
}

const checkNames = Object.keys(report.checks ?? {}).sort();
if (
  checkNames.length !== expectedChecks.length
  || checkNames.some((name, index) => name !== [...expectedChecks].sort()[index])
  || expectedChecks.some((name) => report.checks[name] !== true)
) {
  fail('Every required Microsoft 365 tenant smoke check must be explicitly true.');
}

console.log(`Microsoft 365 tenant smoke verified: PASS on ${report.executedAt}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEvidenceOnlyDescendant(sourceCommit, checkedOutCommit) {
  const ancestry = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', sourceCommit, checkedOutCommit],
    { stdio: 'ignore' },
  );
  if (ancestry.status !== 0) return false;

  try {
    const changedPaths = execFileSync(
      'git',
      ['diff', '--name-only', `${sourceCommit}..${checkedOutCommit}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim().split(/\r?\n/u).filter(Boolean);
    return changedPaths.length === 1 && changedPaths[0] === evidencePath;
  } catch {
    return false;
  }
}
