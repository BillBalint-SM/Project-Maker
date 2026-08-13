import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const playbookUrl = new URL('../playbooks/general.v1.json', import.meta.url);
const integrityFixtureUrl = new URL('./fixtures/general.v1.sha256', import.meta.url);
const contractsDirectory = fileURLToPath(new URL('../', import.meta.url));
const execFileAsync = promisify(execFile);

test('general v1 preserves the complete legacy intake template', async () => {
  const playbook = JSON.parse(await readFile(playbookUrl, 'utf8'));

  assert.equal(playbook.id, 'general');
  assert.equal(playbook.version, 1);
  assert.equal(playbook.name, 'Általános');
  assert.equal(playbook.items.length, 30);
  assert.deepEqual(
    playbook.items.map((item) => item.id),
    Array.from({ length: 30 }, (_, index) => index + 1)
  );

  for (const item of playbook.items) {
    assert.equal(typeof item.category, 'string');
    assert.equal(typeof item.controlPoint, 'string');
    assert.equal(typeof item.exampleQuestion, 'string');
    assert.equal(typeof item.hint, 'string');
    assert.equal(typeof item.requiredForMvp, 'boolean');
    assert.equal(typeof item.requiredForEstimate, 'boolean');
    assert.equal(typeof item.blockingIfMissing, 'boolean');
  }
});

test('general v1 exposes the legacy status vocabulary and scoring policy', async () => {
  const playbook = JSON.parse(await readFile(playbookUrl, 'utf8'));

  assert.deepEqual(playbook.statuses.project, [
    'Előkészítés',
    'Becslés alatt',
    'Fejlesztésre kész',
    'Blokkolt'
  ]);
  assert.deepEqual(playbook.statuses.checklist, [
    'Nincs meg',
    'Részben megvan',
    'Kész',
    'Nem releváns'
  ]);
  assert.deepEqual(playbook.scoring.readiness.weights, {
    baseInfo: 0.2,
    business: 0.2,
    ownership: 0.15,
    checklist: 0.3,
    followUpResolution: 0.15
  });
  assert.deepEqual(playbook.scoring.readiness.inputBindings, {
    baseInfoProjectFields: [
      'name',
      'customerContactName',
      'customerContactEmail'
    ],
    businessChecklistItemIds: [1, 2],
    ownershipProjectFields: ['ballOwner'],
    ownershipChecklistItemIds: [3]
  });
  assert.equal(playbook.scoring.decision.scale.minimum, 1);
  assert.equal(playbook.scoring.decision.scale.maximum, 5);
  assert.equal(playbook.scoring.decision.thresholds.high, 65);
  assert.equal(playbook.scoring.decision.thresholds.medium, 40);
  assert.deepEqual(playbook.scoring.decision.clarificationRules, {
    criticalGap: true,
    estimateBlockingGapsAbove: 2,
    readinessBelow: 40
  });
  assert.deepEqual(playbook.scoring.decision.estimateReadyRules, {
    decisionScoreAtLeast: 65,
    readinessAtLeast: 65,
    estimateBlockingGaps: 0
  });
  assert.deepEqual(playbook.scoring.decision.conditionalEstimateRules, {
    decisionScoreAtLeast: 40,
    readinessAtLeast: 65
  });
});

test('package export presents the canonical playbook as immutable contract data', async () => {
  const { generalPlaybookV1, validateGeneralPlaybook } = await import('../dist/index.js');

  assert.equal(generalPlaybookV1.id, 'general');
  assert.equal(generalPlaybookV1.version, 1);
  assert.equal(generalPlaybookV1.name, 'Általános');
  assert.ok(Object.isFrozen(generalPlaybookV1));
  assert.ok(Object.isFrozen(generalPlaybookV1.items));
  assert.ok(Object.isFrozen(generalPlaybookV1.items[0]));
  assert.throws(
    () => validateGeneralPlaybook({}),
    /General playbook validation failed: expected a string at \$\.id\./
  );
});

test('validation rejects a status vocabulary that differs from the canonical playbook', async () => {
  const { generalPlaybookV1, validateGeneralPlaybook } = await import('../dist/index.js');
  const invalidPlaybook = structuredClone(generalPlaybookV1);

  invalidPlaybook.statuses.project[0] = 'ELÍRÁS';

  assert.throws(
    () => validateGeneralPlaybook(invalidPlaybook),
    /General playbook validation failed: expected the canonical project status vocabulary at \$\.statuses\.project\./
  );
});

test('validation rejects out-of-range scoring policy values', async () => {
  const { generalPlaybookV1, validateGeneralPlaybook } = await import('../dist/index.js');
  const invalidPlaybook = structuredClone(generalPlaybookV1);

  invalidPlaybook.scoring.readiness.weights.baseInfo = 999;

  assert.throws(
    () => validateGeneralPlaybook(invalidPlaybook),
    /General playbook validation failed: expected a policy value from 0 to 1 at \$\.scoring\.readiness\.weights\.baseInfo\./
  );
});

test('validation rejects readiness input bindings that differ from the canonical playbook', async () => {
  const { generalPlaybookV1, validateGeneralPlaybook } = await import('../dist/index.js');
  const invalidPlaybook = structuredClone(generalPlaybookV1);

  invalidPlaybook.scoring.readiness.inputBindings.businessChecklistItemIds[0] = 999;

  assert.throws(
    () => validateGeneralPlaybook(invalidPlaybook),
    /General playbook validation failed: expected the canonical policy value 1 at \$\.scoring\.readiness\.inputBindings\.businessChecklistItemIds\[0\]\./
  );
});

test('general v1 has the independently pinned legacy-migration integrity hash', async () => {
  const expectedHash = (await readFile(integrityFixtureUrl, 'utf8')).trim();
  const source = (await readFile(playbookUrl, 'utf8')).replace(/\r\n/g, '\n');
  const actualHash = createHash('sha256').update(source).digest('hex');

  assert.equal(actualHash, expectedHash);
});

test('packed contracts artifact contains the canonical playbook JSON', async () => {
  const pnpmCliPath = process.env.npm_execpath;

  assert.ok(pnpmCliPath, 'pnpm must provide npm_execpath to run the pack check');

  const { stdout } = await execFileAsync(process.execPath, [pnpmCliPath, 'pack', '--dry-run', '--json'], {
    cwd: contractsDirectory
  });
  const packageManifest = JSON.parse(stdout);

  assert.ok(packageManifest.files.some((file) => file.path === 'playbooks/general.v1.json'));
});
