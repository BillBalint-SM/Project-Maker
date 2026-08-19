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
  assert.equal(projectStatusLabel('DRAFT'), 'Előkészítés alatt');
  assert.equal(projectStatusLabel('INTAKE_IN_PROGRESS'), 'Felmérési szakasz');
  assert.equal(projectStatusLabel('WAITING_INTERNAL'), 'Belső egyeztetésre vár');
  assert.equal(projectStatusLabel('WAITING_CUSTOMER'), 'Ügyfél-visszajelzésre vár');
  assert.equal(projectStatusLabel('READY_FOR_PLANNING'), 'Tervezésre átadva');
  assert.equal(projectStatusLabel('ARCHIVED'), 'Archivált');
});
