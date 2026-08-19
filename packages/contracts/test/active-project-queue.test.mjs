import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  activeProjectUrgencies,
  projectPreparationStates,
} from '../dist/index.js';

const require = createRequire(import.meta.url);

test('active queue filters have canonical CommonJS runtime exports for API metadata', () => {
  const queueRuntime = require('@project-maker/contracts/active-project-queue');
  const preparationRuntime = require('@project-maker/contracts/project-preparation-status');

  assert.deepEqual(queueRuntime.activeProjectUrgencies, activeProjectUrgencies);
  assert.deepEqual(preparationRuntime.projectPreparationStates, projectPreparationStates);
});
