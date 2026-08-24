import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const postgresImage = 'postgres:18.4-alpine3.24';
const databaseName = 'project_maker_test';
const databaseUser = 'project_maker_app';
const databasePassword = 'local-test-only';
const containerName = `project-maker-test-${process.pid}-${randomUUID().slice(0, 8)}`;
const pnpmArgs = process.argv.slice(2);

let containerStarted = false;
let containerStopped = false;

if (pnpmArgs.length === 0) {
  throw new Error('Pass the pnpm arguments to run with the disposable test database.');
}

try {
  await requireDocker();
  await run('docker', [
    'run', '--detach', '--rm', '--name', containerName,
    '--env', `POSTGRES_DB=${databaseName}`,
    '--env', `POSTGRES_USER=${databaseUser}`,
    '--env', `POSTGRES_PASSWORD=${databasePassword}`,
    '--publish', '127.0.0.1::5432',
    postgresImage,
  ], true);
  containerStarted = true;
  await waitForPostgres();
  const port = await publishedPostgresPort();
  const environment = {
    ...process.env,
    DATABASE_URL: `postgres://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}`,
    NODE_ENV: 'test',
  };
  await pnpm(['--filter', '@project-maker/contracts', 'build'], environment);
  await pnpm(['--filter', '@project-maker/api', 'migration:run'], environment);
  await pnpm(pnpmArgs, environment);
} finally {
  await cleanup();
}

async function requireDocker() {
  const result = await run(
    'docker',
    ['info', '--format', '{{.ServerVersion}}'],
    true,
    true,
  );
  if (result.code !== 0) {
    throw new Error('Docker Desktop must be running for the disposable test database.');
  }
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await run(
      'docker',
      ['exec', containerName, 'pg_isready', '-U', databaseUser, '-d', databaseName],
      true,
      true,
    );
    if (result.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The disposable PostgreSQL database did not become ready within 30 seconds.');
}

async function publishedPostgresPort() {
  const result = await run('docker', ['port', containerName, '5432/tcp'], true);
  const port = [...result.stdout.matchAll(/:(\d+)\s*$/gm)].at(-1)?.[1];
  if (!port) throw new Error('Docker did not publish the disposable PostgreSQL port.');
  return port;
}

function pnpm(args, environment) {
  return process.platform === 'win32'
    ? run(
        'cmd.exe',
        ['/d', '/s', '/c', 'npx', '--yes', 'pnpm@11.20.0', ...args],
        false,
        false,
        environment,
      )
    : run('npx', ['--yes', 'pnpm@11.20.0', ...args], false, false, environment);
}

function run(command, args, capture = false, allowFailure = false, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`${command} was terminated by ${signal}.`));
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !allowFailure) {
        const detail = stderr.trim() || stdout.trim();
        return reject(new Error(`${command} exited with code ${exitCode}${detail ? `: ${detail}` : '.'}`));
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

async function cleanup() {
  if (!containerStarted || containerStopped) return;
  await run('docker', ['stop', containerName], true, true);
  containerStopped = true;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

process.once('exit', () => {
  if (containerStarted && !containerStopped) {
    spawnSync('docker', ['stop', containerName], { stdio: 'ignore', windowsHide: true });
  }
});
