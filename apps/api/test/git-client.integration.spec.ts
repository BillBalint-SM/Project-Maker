import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { after, before, describe, it } from 'node:test';

import { GitClient } from '../src/delivery/git-client';

const execute = promisify(execFile);

describe('GitClient local bare repository integration', () => {
  let root = '';
  let remote = '';

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'project-maker-git-test-'));
    remote = join(root, 'remote.git');
    const seed = join(root, 'seed');
    await execute('git', ['init', '--bare', remote]);
    await execute('git', ['init', seed]);
    await execute('git', ['-C', seed, 'config', 'user.name', 'Project Maker Test']);
    await execute('git', ['-C', seed, 'config', 'user.email', 'project-maker-test@example.test']);
    await writeFile(join(seed, 'README.md'), '# Teszt repository\n', 'utf8');
    await execute('git', ['-C', seed, 'add', 'README.md']);
    await execute('git', ['-C', seed, 'commit', '-m', 'Initial commit']);
    await execute('git', ['-C', seed, 'branch', '-M', 'main']);
    await execute('git', ['-C', seed, 'remote', 'add', 'origin', remote]);
    await execute('git', ['-C', seed, 'push', '-u', 'origin', 'main']);
  });

  after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

  it('pushes only the fixed artifact and reconciles the expected commit SHA', async () => {
    const client = new GitClient();
    const target = { remoteUrl: remote, branch: 'main' };
    assert.ok(await client.remoteSha(target, null));
    const prepared = await client.preparePush({
      ...target,
      credential: null,
      artifactPath: 'project-maker-handoffs/11111111-1111-4111-8111-111111111111/delivery-package-v1.md',
      artifactContent: '# Magyar átadási csomag\n\nÁrvíztűrő tükörfúrógép.\n',
      commitMessage: 'Project Maker: local integration delivery package v1',
      committedAt: new Date('2026-08-21T12:00:00.000Z'),
    });
    try {
      await prepared.push();
      assert.equal(await client.remoteSha(target, null), prepared.expectedCommitSha);
    } finally {
      await prepared.dispose();
    }

    const verification = join(root, 'verification');
    await mkdir(verification, { recursive: true });
    await execute('git', ['clone', '--branch', 'main', remote, verification]);
    const artifact = await readFile(join(
      verification,
      'project-maker-handoffs',
      '11111111-1111-4111-8111-111111111111',
      'delivery-package-v1.md',
    ), 'utf8');
    assert.match(artifact, /Árvíztűrő tükörfúrógép/);
  });
});
