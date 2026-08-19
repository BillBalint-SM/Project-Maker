import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const verifierPath = resolve('scripts/verify-domain-language.mjs');

describe('domain language verifier', () => {
  it('accepts the canonical Operator organization and Project Customer language', () => {
    const result = runVerifier(resolve('.'));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Domain language verified/);
  });

  it('rejects infrastructure language that assigns the mailbox to a Customer', () => {
    const repository = mkdtempSync(join(tmpdir(), 'project-maker-domain-language-'));
    try {
      writeFileSync(
        join(repository, 'README.md'),
        'Set CUSTOMER_MAILBOX_ADDRESS in the Customer tenant and Customer environment for the Customer-operated gateway.\n',
        'utf8',
      );

      const result = runVerifier(repository);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /CUSTOMER_MAILBOX_ADDRESS/);
      assert.match(result.stderr, /Customer tenant/);
      assert.match(result.stderr, /Customer environment/);
      assert.match(result.stderr, /Customer-operated/);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});

function runVerifier(repository) {
  return spawnSync(process.execPath, [verifierPath, '--root', repository], {
    cwd: resolve('.'),
    encoding: 'utf8',
  });
}
