import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const postgresImage = 'postgres:18.4-alpine3.24';
const databaseName = 'project_maker_mail_gateway_test';
const databaseUser = 'project_maker_app';
const databasePassword = 'local-mail-gateway-test';
const containerName = `project-maker-mail-gateway-test-${process.pid}-${randomUUID().slice(0, 8)}`;

let containerStarted = false;
let containerStopped = false;
let cleanupPromise = null;

async function main() {
  await requireDocker();

  console.log('Starting a disposable PostgreSQL database for the local mail-gateway suite...');
  await run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name', containerName,
    '--env', `POSTGRES_DB=${databaseName}`,
    '--env', `POSTGRES_USER=${databaseUser}`,
    '--env', `POSTGRES_PASSWORD=${databasePassword}`,
    '--publish', '127.0.0.1::5432',
    postgresImage,
  ], { capture: true });
  containerStarted = true;

  await waitForPostgres();
  const port = await publishedPostgresPort();
  const environment = {
    ...process.env,
    ACTIVE_PROJECT_QUEUE_CURSOR_SECRET: 'local-mail-gateway-cursor-secret-at-least-32-characters',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker-local@example.test',
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker local test',
    CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS: '60000',
    CORS_ORIGIN: 'http://127.0.0.1:4200',
    DATABASE_URL: `postgres://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}`,
    FOLLOW_UP_POLL_INTERVAL_MS: '60000',
    MAIL_GATEWAY_CHECKPOINT_SECRET: 'local-mail-gateway-checkpoint-secret-at-least-32-characters',
    MAIL_GATEWAY_IMAP_FOLDER: 'INBOX',
    MAIL_GATEWAY_IMAP_HOST: '127.0.0.1',
    MAIL_GATEWAY_IMAP_PASSWORD: 'local-imap-password',
    MAIL_GATEWAY_IMAP_PORT: '2143',
    MAIL_GATEWAY_IMAP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_IMAP_USERNAME: 'local-imap-user',
    MAIL_GATEWAY_SMTP_HOST: '127.0.0.1',
    MAIL_GATEWAY_SMTP_PASSWORD: 'local-smtp-password',
    MAIL_GATEWAY_SMTP_PORT: '2525',
    MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_SMTP_USERNAME: 'local-smtp-user',
    NODE_ENV: 'test',
  };

  console.log('Preparing the disposable database and Chromium...');
  await pnpm(['--filter', '@project-maker/contracts', 'build'], environment);
  await pnpm(['--filter', '@project-maker/api', 'migration:run'], environment);
  await pnpm(['--filter', '@project-maker/web', 'exec', 'playwright', 'install', 'chromium'], environment);

  console.log('Running mail-gateway API, protocol, and critical browser tests...');
  await pnpm(['--filter', '@project-maker/api', 'test:mail-gateway'], environment);
  await pnpm([
    '--filter', '@project-maker/web', 'exec', 'playwright', 'test',
    'e2e/customer-follow-up-ping.spec.ts',
  ], environment);
  console.log('Local mail-gateway suite passed. No external mailbox or credentials were used.');
}

async function requireDocker() {
  const result = await run('docker', ['info', '--format', '{{.ServerVersion}}'], {
    allowFailure: true,
    capture: true,
  });
  if (result.code !== 0) {
    throw new Error('Docker Desktop must be running for the disposable local mail-gateway suite.');
  }
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await run('docker', [
      'exec', containerName, 'pg_isready', '-U', databaseUser, '-d', databaseName,
    ], { allowFailure: true, capture: true });
    if (result.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The disposable PostgreSQL database did not become ready within 30 seconds.');
}

async function publishedPostgresPort() {
  const result = await run('docker', ['port', containerName, '5432/tcp'], { capture: true });
  const matches = [...result.stdout.matchAll(/:(\d+)\s*$/gm)];
  const port = matches.at(-1)?.[1];
  if (!port) throw new Error('Docker did not publish the disposable PostgreSQL port.');
  return port;
}

function pnpm(args, environment) {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npx', '--yes', 'pnpm@11.20.0', ...args], {
      environment,
    });
  }
  return run('npx', ['--yes', 'pnpm@11.20.0', ...args], { environment });
}

function run(command, args, options = {}) {
  const { allowFailure = false, capture = false, environment = process.env } = options;
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
      if (signal) {
        reject(new Error(`${command} was terminated by ${signal}.`));
        return;
      }
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !allowFailure) {
        const detail = stderr.trim() || stdout.trim();
        reject(new Error(`${command} exited with code ${exitCode}${detail ? `: ${detail}` : '.'}`));
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

async function cleanup() {
  if (!containerStarted) return;
  if (!cleanupPromise) {
    cleanupPromise = run('docker', ['stop', containerName], {
      allowFailure: true,
      capture: true,
    }).then(() => { containerStopped = true; });
  }
  await cleanupPromise;
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

try {
  await main();
} finally {
  await cleanup();
}
