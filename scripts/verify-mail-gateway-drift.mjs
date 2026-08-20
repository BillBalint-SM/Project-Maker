import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const scanTargets = [
  'README.md', '.env.example', 'compose.yaml', 'package.json',
  '.github', 'docs', 'scripts',
  'apps/api/package.json', 'apps/api/src',
  'apps/web/package.json', 'apps/web/src', 'apps/web/e2e',
  'packages/contracts/src',
];
const excludedDirectories = new Set([
  'docs/superpowers', 'docs/evidence', 'docs/adr', 'apps/api/src/migrations',
]);
const excludedFiles = new Set([
  'scripts/verify-mail-gateway-drift.mjs',
  'scripts/test/verify-mail-gateway-drift.test.mjs',
]);
const forbidden = [
  { label: 'Microsoft Graph runtime dependency', pattern: /\bMicrosoft Graph\b|\bGRAPH_[A-Z_]+\b|microsoft-graph/iu },
  { label: 'Microsoft 365 activation dependency', pattern: /\bMicrosoft 365\b/iu },
  { label: 'Entra activation dependency', pattern: /\bEntra\b/iu },
  { label: 'tenant-administrator dependency', pattern: /tenant(?:-| )admin(?:istrator)?/iu },
  { label: 'application certificate credential', pattern: /(?:application|client|Graph) (?:certificate|private key|thumbprint)/iu },
  { label: 'custom sender behavior', pattern: /(?:custom|personal|alternate) sender|sender-options|OutboundSenderMode/iu },
];
const failures = [];

for (const target of scanTargets) {
  const absoluteTarget = path.join(root, target);
  for (const file of await filesAt(absoluteTarget)) {
    const relative = repositoryPath(file);
    if (excludedFiles.has(relative)) continue;
    if ([...excludedDirectories].some((directory) => relative === directory || relative.startsWith(`${directory}/`))) continue;
    const content = await readFile(file, 'utf8');
    for (const rule of forbidden) {
      if (rule.pattern.test(content)) failures.push(`${relative}: contains ${rule.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Mail gateway drift verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Mail gateway drift verification passed.');
}

async function filesAt(absolutePath) {
  const details = await stat(absolutePath).catch(() => null);
  if (!details) return [];
  if (details.isFile()) return [absolutePath];
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nested = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) files.push(...await filesAt(nested));
    else if (entry.isFile()) files.push(nested);
  }
  return files;
}

function repositoryPath(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}
