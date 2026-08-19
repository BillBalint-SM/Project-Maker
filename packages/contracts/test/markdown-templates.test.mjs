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
      ['project.name', 'Projekt neve', false],
      ['revision.metadata', 'Specifikációverzió metaadatai', false],
      ['project.context', 'Projektkontextus', false],
      ['project.schema', 'Elfogadott projekt-kérdésséma', true],
      ['project.initialIntake', 'Kezdő felmérés', true],
      ['project.readiness', 'Felkészültség', true],
      ['project.decisionReview', 'Döntési értékelés', true],
    ],
  );
});
