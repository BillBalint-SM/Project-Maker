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
    markdownTemplatePlaceholderDefinitions.map(({ name, optional }) => [name, optional]),
    [
      ['project.name', false],
      ['revision.metadata', false],
      ['project.context', false],
      ['project.schema', true],
      ['project.initialIntake', true],
      ['project.readiness', true],
      ['project.decisionReview', true],
    ],
  );
  assert.equal(markdownTemplatePlaceholderDefinitions.every(({ label }) => label.trim().length > 0), true);
});
