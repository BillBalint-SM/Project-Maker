import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(e2eDirectory, '..');
const repositoryDirectory = resolve(webDirectory, '..', '..');
const apiPackagePath = resolve(repositoryDirectory, 'apps', 'api', 'package.json');
const requireFromApi = createRequire(apiPackagePath);
const { Client } = requireFromApi('pg');

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required for web E2E because Playwright starts the real API and runs migrations against PostgreSQL.',
  );
  process.exit(1);
}

await resetLocalE2eDatabase(process.env.DATABASE_URL);
await runPnpmOnce([
  '--dir',
  repositoryDirectory,
  '--filter',
  '@project-maker/api',
  'migration:run',
]);

const apiProcess = spawnPnpm(
  ['--dir', repositoryDirectory, '--filter', '@project-maker/api', 'start'],
  {
    env: {
      ...process.env,
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://127.0.0.1:4200',
    },
    stdio: 'inherit',
    windowsHide: true,
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    apiProcess.kill(signal);
  });
}

apiProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function runPnpmOnce(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnPnpm(args, {
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`pnpm was terminated by ${signal}.`));
        return;
      }
      if (code !== 0) {
        rejectPromise(new Error(`pnpm exited with code ${code}.`));
        return;
      }
      resolvePromise();
    });
  });
}

function spawnPnpm(args, options) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'pnpm', ...args], options);
  }
  return spawn('pnpm', args, options);
}

async function resetLocalE2eDatabase(databaseUrl) {
  assertSafeLocalE2eDatabaseUrl(databaseUrl);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

function assertSafeLocalE2eDatabaseUrl(databaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid local PostgreSQL URL for web E2E.');
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  const databaseName = parsedUrl.pathname.replace(/^\//, '');
  if (
    (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') ||
    !localHosts.has(parsedUrl.hostname) ||
    !/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)
  ) {
    throw new Error(
      'Web E2E resets its database before migrations. DATABASE_URL must point to a localhost PostgreSQL database whose name contains test or e2e.',
    );
  }
}
