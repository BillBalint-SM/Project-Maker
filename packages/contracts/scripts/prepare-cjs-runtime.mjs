import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/runtime-cjs', { recursive: true });
await writeFile('dist/runtime-cjs/package.json', '{"type":"commonjs"}\n', 'utf8');
await writeFile(
  'dist/runtime-cjs/general-playbook-runtime.js',
  `let contractsPromise;

function loadContracts() {
  contractsPromise ??= import('../index.js');
  return contractsPromise;
}

function loadGeneralPlaybookV1() {
  return loadContracts().then(({ generalPlaybookV1 }) => generalPlaybookV1);
}

function loadPackagedPlaybook(id, version) {
  return loadContracts().then(({ findPackagedPlaybook }) => findPackagedPlaybook(id, version));
}

function loadPackagedPlaybookSummaries() {
  return loadContracts().then(({ packagedPlaybookSummaries }) => packagedPlaybookSummaries);
}

module.exports = { loadGeneralPlaybookV1, loadPackagedPlaybook, loadPackagedPlaybookSummaries };
`,
  'utf8',
);
