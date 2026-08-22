import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const projectName = `project-maker-container-smoke-${process.pid}-${Date.now()}`;
const compose = ['compose', '--env-file', '.env.example', '--project-name', projectName];

try {
  run([...compose, 'build', 'api']);
  run([
    ...compose,
    'run',
    '--rm',
    '--no-deps',
    '--entrypoint',
    'sh',
    'api',
    '-c',
    [
      'test ! -e /usr/local/bin/pnpm',
      'test ! -e /workspace/pnpm-lock.yaml',
      'test ! -d /workspace/apps',
      'test -f /workspace/node_modules/@project-maker/contracts/dist/index.js',
    ].join(' && '),
  ]);
  run([
    ...compose,
    'run',
    '--rm',
    '--no-deps',
    '--entrypoint',
    'node',
    'api',
    '-e',
    `const { loadGeneralPlaybookV1 } = require('@project-maker/contracts/general-playbook-runtime');
     loadGeneralPlaybookV1().then((playbook) => {
       if (playbook.id !== 'general' || playbook.version !== 1) {
         throw new Error('The canonical general v1 playbook is unavailable.');
       }
     });`,
  ]);
  run([...compose, 'up', '--wait', 'postgres', 'api']);
  run(
    [...compose, 'exec', '-T', 'api', 'node', '--input-type=module', '-'],
    readFileSync('apps/api/test/container-smoke.mjs'),
  );
} finally {
  run([...compose, 'down', '--volumes', '--remove-orphans'], undefined, true);
}

function run(args, input, ignoreFailure = false) {
  const result = spawnSync('docker', args, {
    cwd: process.cwd(),
    input,
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });
  if (result.error && !ignoreFailure) throw result.error;
  if (result.status !== 0 && !ignoreFailure) {
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed with exit code ${String(result.status)}.`);
  }
}
