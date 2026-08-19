import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();

const productionBoundaryRoots = [
  'apps/api/src/follow-ups',
  'apps/web/src/app/projects/customer-follow-up',
];
const productionBoundaryFiles = [
  'packages/contracts/src/customer-mail.ts',
  'packages/contracts/src/follow-ups.ts',
];

const forbiddenProductionConcepts = [
  { label: 'Markdown dependency', pattern: /(?:from\s+|import\s*\()(['"])[^'"]*markdown[^'"]*\1/i },
  { label: 'Markdown revision identifier', pattern: /\brevisionId\b/ },
  { label: '.md delivery concept', pattern: /\.md\b/i },
  { label: 'legacy customer-review route', pattern: /customer-review-email/i },
  { label: 'Claude delivery concept', pattern: /Claude(?: Code)?/i },
];

const currentDocumentationExpectations = [
  {
    file: '.planning/REQUIREMENTS.md',
    required: ['- [x] **COMM-01.1:**'],
  },
  {
    file: 'docs/roadmap.md',
    required: ['| `COMM-01.1` |', '| `OUTPUT-01.1` |'],
  },
  {
    file: '.planning/STATE.md',
    required: ['COMM-01.1'],
  },
  {
    file: 'docs/user-guide.md',
    required: ['egyetlen teljes ügyfél-összefoglaló'],
    forbidden: [
      /Külső e-mail-hibánál[^\n]*Markdown/i,
      /Claude Code átadás előtt/i,
    ],
  },
  {
    file: 'docs/operations-handoff.md',
    required: ['Customer SMTP boundary'],
  },
];

const failures = [];
let verifiedProductionFileCount = 0;

for (const relativeRoot of productionBoundaryRoots) {
  const absoluteRoot = path.join(repositoryRoot, relativeRoot);
  for (const absoluteFile of await listTypeScriptFiles(absoluteRoot)) {
    await verifyProductionFile(absoluteFile);
  }
}
for (const relativeFile of productionBoundaryFiles) {
  await verifyProductionFile(path.join(repositoryRoot, relativeFile));
}

for (const expectation of currentDocumentationExpectations) {
  const absoluteFile = path.join(repositoryRoot, expectation.file);
  const content = await readFile(absoluteFile, 'utf8');
  for (const requiredText of expectation.required) {
    if (!content.includes(requiredText)) {
      failures.push(`${expectation.file}: missing current-delivery evidence: ${requiredText}`);
    }
  }
  for (const forbiddenPattern of expectation.forbidden ?? []) {
    if (forbiddenPattern.test(content)) {
      failures.push(`${expectation.file}: contains stale current-workflow guidance: ${forbiddenPattern}`);
    }
  }
  if (content.includes('SMTP_SEND_FAILED')) {
    failures.push(`${expectation.file}: contains the retired SMTP_SEND_FAILED example`);
  }
}

if (failures.length > 0) {
  console.error('COMM-01.1 boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `COMM-01.1 boundary verification passed (${verifiedProductionFileCount} production files, ${currentDocumentationExpectations.length} current documents).`,
  );
}

async function verifyProductionFile(absoluteFile) {
  verifiedProductionFileCount += 1;
  const content = await readFile(absoluteFile, 'utf8');
  const relativeFile = path.relative(repositoryRoot, absoluteFile).replaceAll('\\', '/');
  for (const forbidden of forbiddenProductionConcepts) {
    if (forbidden.pattern.test(content)) {
      failures.push(`${relativeFile}: exposes forbidden ${forbidden.label}`);
    }
  }
}

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absoluteEntry = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTypeScriptFiles(absoluteEntry));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(absoluteEntry);
    }
  }
  return files;
}
