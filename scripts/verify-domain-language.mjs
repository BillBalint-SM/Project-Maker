import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = resolveRepositoryRoot(process.argv.slice(2));
const excludedPaths = new Set([
  'scripts/verify-domain-language.mjs',
  'scripts/test/verify-domain-language.test.mjs',
]);
const scannedExtensions = new Set(['.example', '.md', '.mjs', '.ps1', '.ts', '.yaml', '.yml']);
const forbiddenLanguage = [
  { label: 'legacy mailbox configuration', pattern: /\bCUSTOMER_MAILBOX_(?:NAME|ADDRESS|SYNC_POLL_INTERVAL_MS)\b/g },
  { label: 'Operator organization named as Customer tenant', pattern: /\bCustomer(?:'s)? tenant\b/gi },
  { label: 'Operator administrator named as Customer administrator', pattern: /\bCustomer administrators?\b/gi },
  { label: 'ownership-ambiguous Customer mailbox', pattern: /\bCustomer mailbox\b/gi },
  { label: 'ownership-ambiguous Customer operation', pattern: /\bCustomer[- ]operated\b/gi },
  { label: 'ownership-ambiguous Customer infrastructure', pattern: /\bCustomer[- ]provided\s+(?:SMTP\/IMAP\s+)?gateway\b/gi },
  { label: 'Operator environment named as Customer environment', pattern: /\bCustomer(?:'s)? environment\b/gi },
  { label: 'ownership-ambiguous Hungarian gateway', pattern: /ügyfél által biztosított\s+(?:SMTP\/IMAP\s+)?gateway/gi },
  { label: 'ownership-ambiguous Hungarian activation', pattern: /ügyféloldali aktiválás/gi },
  { label: 'ownership-ambiguous Hungarian environment', pattern: /ügyfélkörnyezet/gi },
];
const requiredLanguage = [
  { file: 'CONTEXT.md', text: '**Operator organization**:' },
  { file: 'CONTEXT.md', text: '**Project Customer**:' },
  { file: 'CONTEXT.md', text: '**Customer contact**:' },
  { file: 'CONTEXT.md', text: '**Correspondence mailbox**:' },
  { file: 'CONTEXT.md', text: 'documentation calls it `üzemeltető szervezet`.' },
  { file: 'docs/agents/domain.md', text: 'always means the external Project Customer' },
  { file: 'docs/adr/0003-use-operator-provided-mail-gateway.md', text: '# Use an Operator organization-provided mail gateway' },
];

const failures = [];
let scannedFileCount = 0;

for (const absoluteFile of await listScannableFiles(repositoryRoot)) {
  const relativeFile = toRepositoryPath(absoluteFile);
  if (excludedPaths.has(relativeFile)) {
    continue;
  }
  const content = withoutGlossaryAvoidLines(await readFile(absoluteFile, 'utf8'));
  scannedFileCount += 1;
  for (const forbidden of forbiddenLanguage) {
    forbidden.pattern.lastIndex = 0;
    const match = forbidden.pattern.exec(content);
    if (match) failures.push(`${relativeFile}: ${forbidden.label}: ${match[0]}`);
  }
}

for (const requirement of requiredLanguage) {
  try {
    const content = await readFile(path.join(repositoryRoot, requirement.file), 'utf8');
    if (!content.includes(requirement.text)) {
      failures.push(`${requirement.file}: missing canonical language: ${requirement.text}`);
    }
  } catch {
    failures.push(`${requirement.file}: missing canonical language source`);
  }
}

if (failures.length > 0) {
  console.error('Domain language verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Domain language verified (${scannedFileCount} files).`);
}

function resolveRepositoryRoot(args) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1) return process.cwd();
  const value = args[rootIndex + 1];
  if (!value) throw new Error('--root requires a directory path.');
  return path.resolve(value);
}

async function listScannableFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'dist' || entry.name === 'node_modules') continue;
    const absoluteEntry = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listScannableFiles(absoluteEntry));
    } else if (entry.isFile() && scannedExtensions.has(path.extname(entry.name))) {
      files.push(absoluteEntry);
    }
  }
  return files;
}

function withoutGlossaryAvoidLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('_Avoid_:'))
    .join('\n');
}

function toRepositoryPath(absoluteFile) {
  return path.relative(repositoryRoot, absoluteFile).replaceAll('\\', '/');
}
