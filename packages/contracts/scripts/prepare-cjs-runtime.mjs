import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/runtime-cjs', { recursive: true });
await writeFile('dist/runtime-cjs/package.json', '{"type":"commonjs"}\n', 'utf8');
await writeFile(
  'dist/runtime-cjs/general-playbook-runtime.js',
  `let generalPlaybookV1Promise;

function loadGeneralPlaybookV1() {
  generalPlaybookV1Promise ??= import('../index.js').then(
    ({ generalPlaybookV1 }) => generalPlaybookV1,
  );
  return generalPlaybookV1Promise;
}

module.exports = { loadGeneralPlaybookV1 };
`,
  'utf8',
);
