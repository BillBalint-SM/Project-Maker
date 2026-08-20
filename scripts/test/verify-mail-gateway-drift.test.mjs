import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const verifierPath = resolve('scripts/verify-mail-gateway-drift.mjs');

describe('mail gateway drift verifier', () => {
  it('accepts TLS gateway terminology and historical migration records', () => {
    const repository = fixture();
    try {
      writeFileSync(join(repository, 'README.md'), 'MAIL_GATEWAY_SMTP_HOST uses TLS SMTP.\n');
      mkdirSync(join(repository, 'apps', 'api', 'src', 'migrations'), { recursive: true });
      writeFileSync(join(repository, 'apps', 'api', 'src', 'migrations', '0017-m365.ts'), 'Microsoft Graph historical migration\n');
      const result = runVerifier(repository);
      assert.equal(result.status, 0, result.stderr);
    } finally { rmSync(repository, { recursive: true, force: true }); }
  });

  it('rejects current Graph and custom sender references', () => {
    const repository = fixture();
    try {
      writeFileSync(join(repository, 'README.md'), 'Microsoft Graph and custom sender\n');
      writeFileSync(join(repository, '.github', 'workflows', 'ci.yml'), 'GRAPH_CLIENT_ID: retired\n');
      const result = runVerifier(repository);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Microsoft Graph runtime dependency/);
      assert.match(result.stderr, /custom sender behavior/);
    } finally { rmSync(repository, { recursive: true, force: true }); }
  });
});

function fixture() {
  const repository = mkdtempSync(join(tmpdir(), 'project-maker-mail-gateway-drift-'));
  for (const directory of ['.github/workflows', 'docs', 'scripts/test', 'apps/api/src', 'apps/web/src', 'apps/web/e2e', 'packages/contracts/src']) mkdirSync(join(repository, directory), { recursive: true });
  for (const file of ['README.md', '.env.example', 'compose.yaml', 'package.json']) writeFileSync(join(repository, file), '{}\n');
  return repository;
}

function runVerifier(repository) {
  return spawnSync(process.execPath, [verifierPath], { cwd: repository, encoding: 'utf8' });
}
