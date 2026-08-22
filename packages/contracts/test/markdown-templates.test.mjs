import assert from 'node:assert/strict';
import test from 'node:test';

import {
  markdownTemplatePlaceholderDefinitions,
  markdownTemplatePlaceholderNames,
} from '../dist/markdown-templates.js';

test('Markdown template placeholders publish one ordered required/optional definition contract', () => {
  assert.deepEqual(
    markdownTemplatePlaceholderDefinitions.map(({ name }) => name),
    markdownTemplatePlaceholderNames,
  );
  assert.deepEqual(
    markdownTemplatePlaceholderDefinitions.map(({ name, label, optional }) => [name, label, optional]),
    [
      ['project.name', 'Project name', false],
      ['revision.metadata', 'Specification version metadata', false],
      ['project.context', 'Project context', false],
      ['project.schema', 'Accepted Project question schema', true],
      ['project.initialIntake', 'Initial Intake', true],
      ['project.readiness', 'Estimation readiness', true],
      ['project.decisionReview', 'Decision Review', true],
    ],
  );
});
