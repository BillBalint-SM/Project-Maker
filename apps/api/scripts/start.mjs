import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const migrationDataSource = require('../dist/database/migration-data-source.js').default;

await migrationDataSource.initialize();
try {
  await migrationDataSource.runMigrations();
} finally {
  await migrationDataSource.destroy();
}

const apiProcess = spawn(process.execPath, ['dist/main.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

const forwardSignal = (signal) => {
  apiProcess.kill(signal);
};
process.once('SIGTERM', () => forwardSignal('SIGTERM'));
process.once('SIGINT', () => forwardSignal('SIGINT'));

const exitCode = await new Promise((resolve) => {
  apiProcess.once('exit', (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
