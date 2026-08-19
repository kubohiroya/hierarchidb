import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readGitChangedPaths } from '../naming-audit/readGitChangedPaths.js';

const temporaryDirectories: string[] = [];

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository(): { readonly root: string; readonly baseRef: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naming-audit-git-diff-'));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, 'app/src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/src/Modified.ts'), 'export const Modified = 1;\n');
  fs.writeFileSync(path.join(root, 'app/src/Deleted.ts'), 'export const Deleted = 1;\n');
  fs.writeFileSync(path.join(root, 'app/src/Renamed.ts'), 'export const Renamed = 1;\n');

  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.name', 'Naming Audit Test']);
  runGit(root, ['config', 'user.email', 'naming-audit@example.invalid']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', 'initial']);
  return { root, baseRef: runGit(root, ['rev-parse', 'HEAD']) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('readGitChangedPaths', () => {
  it('returns added, modified, and rename destination paths while excluding deletions', () => {
    const { root, baseRef } = createRepository();
    fs.writeFileSync(path.join(root, 'app/src/Modified.ts'), 'export const Modified = 2;\n');
    fs.writeFileSync(path.join(root, 'app/src/Added.ts'), 'export const Added = 1;\n');
    fs.copyFileSync(path.join(root, 'app/src/Modified.ts'), path.join(root, 'app/src/Copied.ts'));
    fs.rmSync(path.join(root, 'app/src/Deleted.ts'));
    fs.renameSync(path.join(root, 'app/src/Renamed.ts'), path.join(root, 'app/src/RenamedNext.ts'));
    runGit(root, ['add', '-A']);
    runGit(root, ['commit', '-m', 'change files']);

    expect(readGitChangedPaths(baseRef, { cwd: root })).toEqual([
      'app/src/Added.ts',
      'app/src/Copied.ts',
      'app/src/Modified.ts',
      'app/src/RenamedNext.ts',
    ]);
  });

  it('fails for an invalid base ref', () => {
    const { root } = createRepository();

    expect(() => readGitChangedPaths('missing-base-ref', { cwd: root })).toThrow();
  });
});
