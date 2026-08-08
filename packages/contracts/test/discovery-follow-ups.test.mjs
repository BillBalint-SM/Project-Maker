import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('discovery follow-ups export the closed categories and use the canonical follow-up status source', async () => {
  const {
    discoveryFollowUpCategories,
    generalPlaybookV1,
  } = await import('../dist/index.js');

  assert.deepEqual(discoveryFollowUpCategories, [
    'BUSINESS',
    'SCOPE',
    'TECHNICAL',
    'DATA',
    'INTEGRATION',
    'SECURITY',
    'OPERATIONS',
    'OTHER',
  ]);
  assert.equal(generalPlaybookV1.statuses.followUp[0], 'Nyitott');
  assert.ok(generalPlaybookV1.statuses.followUp.includes('Nyitott'));
});

test('discovery follow-up categories have a CommonJS runtime export for API metadata', () => {
  const runtime = require('@project-maker/contracts/discovery-follow-ups');

  assert.deepEqual(runtime.discoveryFollowUpCategories, [
    'BUSINESS',
    'SCOPE',
    'TECHNICAL',
    'DATA',
    'INTEGRATION',
    'SECURITY',
    'OPERATIONS',
    'OTHER',
  ]);
});

test('general playbook runtime loader returns the canonical initial follow-up status', async () => {
  const runtime = require('@project-maker/contracts/general-playbook-runtime');
  const generalPlaybookV1 = await runtime.loadGeneralPlaybookV1();

  assert.equal(generalPlaybookV1.statuses.followUp[0], 'Nyitott');
});
