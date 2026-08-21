import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import type { StoredGitCredential } from './credential-crypto';

export interface GitTarget {
  readonly remoteUrl: string;
  readonly branch: string;
}

export interface PrepareGitPushInput extends GitTarget {
  readonly credential: StoredGitCredential | null;
  readonly artifactPath: string;
  readonly artifactContent: string;
  readonly commitMessage: string;
  readonly committedAt: Date;
}

export interface PreparedGitPush {
  readonly expectedCommitSha: string;
  push(): Promise<void>;
  dispose(): Promise<void>;
}

export type GitFailureCode =
  | 'AUTHENTICATION_FAILED'
  | 'NON_FAST_FORWARD'
  | 'REMOTE_UNREACHABLE'
  | 'PUSH_RESULT_UNKNOWN'
  | 'GIT_FAILED';

export class GitOperationError extends Error {
  constructor(readonly code: GitFailureCode) {
    super(code);
  }
}

@Injectable()
export class GitClient {
  async remoteSha(target: GitTarget, credential: StoredGitCredential | null): Promise<string | null> {
    const auth = await createAuthenticationEnvironment(credential);
    try {
      const result = await runGit(['ls-remote', target.remoteUrl, `refs/heads/${target.branch}`], undefined, auth.environment);
      return result.stdout.trim().split(/\s+/)[0] || null;
    } catch (error) {
      throw classify(error, false);
    } finally {
      await auth.dispose();
    }
  }

  async preparePush(input: PrepareGitPushInput): Promise<PreparedGitPush> {
    assertArtifactPath(input.artifactPath);
    const workspace = await mkdtemp(join(tmpdir(), 'project-maker-git-'));
    const repository = join(workspace, 'repository');
    const hooks = join(workspace, 'empty-hooks');
    await mkdir(hooks, { recursive: true });
    const auth = await createAuthenticationEnvironment(input.credential, workspace);
    const dispose = async () => {
      await auth.dispose(false);
      await rm(workspace, { recursive: true, force: true });
    };
    try {
      await runGit([
        'clone', '--single-branch', '--branch', input.branch, '--no-tags',
        '--config', `core.hooksPath=${hooks}`, '--', input.remoteUrl, repository,
      ], undefined, auth.environment);
      const artifactFile = resolve(repository, ...input.artifactPath.split('/'));
      if (!relative(repository, artifactFile) || relative(repository, artifactFile).startsWith('..')) {
        throw new GitOperationError('GIT_FAILED');
      }
      await mkdir(dirname(artifactFile), { recursive: true });
      await writeFile(artifactFile, input.artifactContent, 'utf8');
      await runGit(['-C', repository, '-c', `core.hooksPath=${hooks}`, 'add', '--', input.artifactPath], undefined, auth.environment);
      const commitEnvironment = {
        ...auth.environment,
        GIT_AUTHOR_NAME: 'Project Maker',
        GIT_AUTHOR_EMAIL: 'project-maker@local',
        GIT_COMMITTER_NAME: 'Project Maker',
        GIT_COMMITTER_EMAIL: 'project-maker@local',
        GIT_AUTHOR_DATE: input.committedAt.toISOString(),
        GIT_COMMITTER_DATE: input.committedAt.toISOString(),
      };
      await runGit([
        '-C', repository, '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgSign=false',
        'commit', '--no-verify', '-m', input.commitMessage,
      ], undefined, commitEnvironment);
      const expectedCommitSha = (await runGit(['-C', repository, 'rev-parse', 'HEAD'], undefined, auth.environment)).stdout.trim();
      return {
        expectedCommitSha,
        push: async () => {
          try {
            await runGit([
              '-C', repository, '-c', `core.hooksPath=${hooks}`, '-c', 'credential.helper=',
              'push', 'origin', `HEAD:refs/heads/${input.branch}`,
            ], undefined, auth.environment);
          } catch (error) { throw classify(error, true); }
        },
        dispose,
      };
    } catch (error) {
      await dispose();
      throw error instanceof GitOperationError ? error : classify(error, false);
    }
  }
}

interface AuthenticationEnvironment {
  readonly environment: NodeJS.ProcessEnv;
  dispose(removeDirectory?: boolean): Promise<void>;
}

async function createAuthenticationEnvironment(
  credential: StoredGitCredential | null,
  existingDirectory?: string,
): Promise<AuthenticationEnvironment> {
  const directory = existingDirectory ?? await mkdtemp(join(tmpdir(), 'project-maker-git-auth-'));
  const ownsDirectory = !existingDirectory;
  const environment = safeProcessEnvironment();
  if (credential?.mode === 'HTTPS_TOKEN') {
    const askPass = await writeAskPass(directory, 'PM_GIT_USERNAME', 'PM_GIT_SECRET');
    Object.assign(environment, {
      GIT_ASKPASS: askPass,
      GIT_ASKPASS_REQUIRE: 'force',
      GIT_TERMINAL_PROMPT: '0',
      PM_GIT_USERNAME: credential.username || 'git',
      PM_GIT_SECRET: credential.accessToken ?? '',
    });
  } else if (credential?.mode === 'SSH_KEY') {
    const keyFile = join(directory, 'identity');
    await writeFile(keyFile, credential.privateKey ?? '', { encoding: 'utf8', mode: 0o600 });
    await chmod(keyFile, 0o600);
    Object.assign(environment, {
      GIT_SSH_COMMAND: `ssh -i "${keyFile.replaceAll('"', '\\"')}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="${join(directory, 'known_hosts')}"`,
      GIT_TERMINAL_PROMPT: '0',
    });
    if (credential.passphrase) {
      const askPass = await writeAskPass(directory, 'PM_GIT_PASSPHRASE', 'PM_GIT_PASSPHRASE');
      Object.assign(environment, {
        SSH_ASKPASS: askPass,
        SSH_ASKPASS_REQUIRE: 'force',
        DISPLAY: 'project-maker',
        PM_GIT_PASSPHRASE: credential.passphrase,
      });
    }
  }
  return {
    environment,
    async dispose(removeDirectory = true): Promise<void> {
      for (const key of ['PM_GIT_USERNAME', 'PM_GIT_SECRET', 'PM_GIT_PASSPHRASE']) delete environment[key];
      if (ownsDirectory && removeDirectory) await rm(directory, { recursive: true, force: true });
    },
  };
}

async function writeAskPass(directory: string, usernameVariable: string, secretVariable: string): Promise<string> {
  if (process.platform === 'win32') {
    const script = join(directory, `askpass-${Math.random().toString(36).slice(2)}.cmd`);
    const content = usernameVariable === secretVariable
      ? `@echo off\r\necho %${secretVariable}%\r\n`
      : `@echo off\r\necho %1 | findstr /I username >nul && (echo %${usernameVariable}%) || (echo %${secretVariable}%)\r\n`;
    await writeFile(script, content, 'utf8');
    return script;
  }
  const script = join(directory, `askpass-${Math.random().toString(36).slice(2)}.sh`);
  const content = usernameVariable === secretVariable
    ? `#!/bin/sh\nprintf '%s\\n' "$${secretVariable}"\n`
    : `#!/bin/sh\ncase "$1" in *sername*) printf '%s\\n' "$${usernameVariable}";; *) printf '%s\\n' "$${secretVariable}";; esac\n`;
  await writeFile(script, content, { encoding: 'utf8', mode: 0o700 });
  await chmod(script, 0o700);
  return script;
}

function safeProcessEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { GIT_TERMINAL_PROMPT: '0' };
  for (const name of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE']) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return environment;
}

async function runGit(
  args: readonly string[],
  cwd: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('git', args, { cwd, env: environment, windowsHide: true, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { if (stdout.length < 32_000) stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { if (stderr.length < 32_000) stderr += chunk.toString('utf8'); });
    const timeout = setTimeout(() => child.kill(), 30_000);
    child.once('error', (error) => { clearTimeout(timeout); rejectPromise(error); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new GitCommandError(stderr));
    });
  });
}

class GitCommandError extends Error {
  constructor(readonly stderr: string) { super('Git command failed.'); }
}

function classify(error: unknown, pushMayHaveReachedRemote: boolean): GitOperationError {
  const text = error instanceof GitCommandError ? error.stderr.toLowerCase() : '';
  if (/authentication|permission denied|access denied|could not read username|publickey/.test(text)) {
    return new GitOperationError('AUTHENTICATION_FAILED');
  }
  if (/non-fast-forward|fetch first|rejected|protected branch/.test(text)) {
    return new GitOperationError('NON_FAST_FORWARD');
  }
  if (/could not resolve|connection refused|unable to access|no route to host/.test(text)) {
    return new GitOperationError('REMOTE_UNREACHABLE');
  }
  if (pushMayHaveReachedRemote && /connection|timed out|timeout|unexpected disconnect|remote end hung up|eof/.test(text)) {
    return new GitOperationError('PUSH_RESULT_UNKNOWN');
  }
  return new GitOperationError('GIT_FAILED');
}

function assertArtifactPath(path: string): void {
  if (!path.startsWith('project-maker-handoffs/') || path.startsWith('/') || path.includes('..') || path.includes('\\')) {
    throw new GitOperationError('GIT_FAILED');
  }
}
