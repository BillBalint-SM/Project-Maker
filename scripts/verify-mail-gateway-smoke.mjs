import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const evidencePath = 'docs/evidence/mail-gateway-smoke.json';
const expectedFields = new Set([
  'schemaVersion', 'environment', 'executedAt', 'commit', 'result', 'checks',
]);
const expectedChecks = [
  'smtpTlsSubmissionAccepted',
  'dedicatedSenderIdentityPreserved',
  'replyToPreserved',
  'imapInboxBaselineEstablished',
  'imapReplyDetected',
  'exactCorrelationRetained',
  'replayDeduplicated',
  'boundedRedactedFailureVerified',
  'tlsVerificationEnforced',
  'fakeGatewayInsufficientAcknowledged',
];

const [mode, candidatePath] = process.argv.slice(2);
const requirePass = mode === '--require-pass';
const reportPath = requirePass ? candidatePath : mode;
if (!reportPath) fail('Usage: node scripts/verify-mail-gateway-smoke.mjs [--require-pass] <result.json>');

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  fail('The mail gateway smoke result is missing or is not valid JSON.');
}

if (!isRecord(report) || Object.keys(report).some((key) => !expectedFields.has(key))) {
  fail('The mail gateway smoke result may contain only the approved redacted fields.');
}

if (report.schemaVersion !== 1 || report.environment !== 'CONTROLLED_NON_CI_GATEWAY' || !isRecord(report.checks)) fail('The mail gateway smoke result has an invalid schema.');
if (report.result === 'NOT_RUN') {
  if (requirePass) fail('The mail gateway smoke result is incomplete or not a passing controlled gateway run.');
  if (report.executedAt !== null || report.commit !== null || expectedChecks.some((name) => report.checks[name] !== (name === 'fakeGatewayInsufficientAcknowledged' ? true : false))) fail('The mail gateway smoke template must retain its bounded NOT_RUN values.');
  console.log('Mail gateway smoke schema verified: NOT_RUN.');
  process.exit(0);
}
if (!/^\d{4}-\d{2}-\d{2}$/u.test(report.executedAt ?? '') || !/^[0-9a-f]{40}$/u.test(report.commit ?? '') || report.result !== 'PASS') fail('The mail gateway smoke result is incomplete or not a passing controlled gateway run.');

const checkedOutCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (report.commit !== checkedOutCommit && !isEvidenceOnlyDescendant(report.commit, checkedOutCommit)) {
  fail('The mail gateway smoke evidence does not match the checked-out commit.');
}

const checkNames = Object.keys(report.checks).sort();
if (
  checkNames.length !== expectedChecks.length
  || checkNames.some((name, index) => name !== [...expectedChecks].sort()[index])
  || expectedChecks.some((name) => report.checks[name] !== true)
) {
  fail('Every required mail gateway smoke check must be explicitly true.');
}

console.log(`Mail gateway smoke verified: PASS on ${report.executedAt}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEvidenceOnlyDescendant(sourceCommit, checkedOutCommit) {
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', sourceCommit, checkedOutCommit], { stdio: 'ignore' });
  if (ancestry.status !== 0) return false;
  try {
    const changedPaths = execFileSync('git', ['diff', '--name-only', `${sourceCommit}..${checkedOutCommit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim().split(/\r?\n/u).filter(Boolean);
    return changedPaths.length === 1 && changedPaths[0] === evidencePath;
  } catch {
    return false;
  }
}
