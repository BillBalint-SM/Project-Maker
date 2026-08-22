import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  administrativeProjectPhaseOptions,
  projectStatusLabel,
} from '../dist/index.js';

const require = createRequire(import.meta.url);

test('administrative project phase labels are canonical across runtimes', () => {
  const runtime = require('@project-maker/contracts/runtime');

  assert.deepEqual(runtime.administrativeProjectPhaseOptions, administrativeProjectPhaseOptions);
  assert.equal(projectStatusLabel('DRAFT'), 'In preparation');
  assert.equal(projectStatusLabel('INTAKE_IN_PROGRESS'), 'Discovery in progress');
  assert.equal(projectStatusLabel('WAITING_INTERNAL'), 'Awaiting internal alignment');
  assert.equal(projectStatusLabel('WAITING_CUSTOMER'), 'Awaiting Customer feedback');
  assert.equal(projectStatusLabel('READY_FOR_PLANNING'), 'Handed over for planning');
  assert.equal(projectStatusLabel('ARCHIVED'), 'Archived');
});
