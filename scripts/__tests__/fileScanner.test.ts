import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanFiles } from '../naming-audit/fileScanner.js';

const temporaryDirectories: string[] = [];

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naming-audit-file-scanner-'));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, 'packages/example/src/__tests__'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'packages/example/src/Included.ts'),
    'export const Included = 1;'
  );
  fs.writeFileSync(path.join(root, 'packages/example/src/Other.ts'), 'export const Other = 1;');
  fs.writeFileSync(
    path.join(root, 'packages/example/src/types.d.ts'),
    'export type Value = string;'
  );
  fs.writeFileSync(
    path.join(root, 'packages/example/src/__tests__/Ignored.ts'),
    'export const Ignored = 1;'
  );
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('scanFiles includeFiles', () => {
  it('returns only explicitly included files inside target directories', () => {
    const root = createFixture();
    const included = path.join(root, 'packages/example/src/Included.ts');

    const files = scanFiles({
      rootDir: root,
      targetDirs: [path.join(root, 'packages/*/src')],
      excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
      includeFiles: [included],
    });

    expect(files).toHaveLength(1);
    expect(files[0]?.absolutePath).toBe(included);
    expect(files[0]?.relativePath).toBe('Included.ts');
  });

  it('preserves declaration and __tests__ exclusions', () => {
    const root = createFixture();

    const files = scanFiles({
      rootDir: root,
      targetDirs: [path.join(root, 'packages/*/src')],
      excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
      includeFiles: [
        path.join(root, 'packages/example/src/types.d.ts'),
        path.join(root, 'packages/example/src/__tests__/Ignored.ts'),
      ],
    });

    expect(files).toEqual([]);
  });

  it('returns no files when the changed paths are outside target directories', () => {
    const root = createFixture();

    const files = scanFiles({
      rootDir: root,
      targetDirs: [path.join(root, 'packages/*/src')],
      excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
      includeFiles: [path.join(root, 'scripts/tool.ts')],
    });

    expect(files).toEqual([]);
  });

  it('returns no files for an empty changed-file set', () => {
    const root = createFixture();

    const files = scanFiles({
      rootDir: root,
      targetDirs: [path.join(root, 'packages/*/src')],
      excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
      includeFiles: [],
    });

    expect(files).toEqual([]);
  });

  it('selects the same FileEntry as a full scan for an included file', () => {
    const root = createFixture();
    const targetDirs = [path.join(root, 'packages/*/src')];
    const excludePatterns = ['dist/', '*.d.ts', '__tests__/'];
    const included = path.join(root, 'packages/example/src/Included.ts');

    const fullScan = scanFiles({ rootDir: root, targetDirs, excludePatterns });
    const incrementalScan = scanFiles({
      rootDir: root,
      targetDirs,
      excludePatterns,
      includeFiles: [included],
    });

    expect(incrementalScan).toEqual(fullScan.filter((file) => file.absolutePath === included));
  });

  it('allows selected files to be absent from a base revision', () => {
    const root = createFixture();

    const files = scanFiles({
      rootDir: root,
      targetDirs: [path.join(root, 'packages/*/src')],
      excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
      includeFiles: ['packages/example/src/AddedOnHead.ts'],
      allowMissingIncludeFiles: true,
    });

    expect(files).toEqual([]);
  });

  it('rejects an absent selected file in the head revision', () => {
    const root = createFixture();

    expect(() =>
      scanFiles({
        rootDir: root,
        targetDirs: [path.join(root, 'packages/*/src')],
        excludePatterns: ['dist/', '*.d.ts', '__tests__/'],
        includeFiles: ['packages/example/src/MissingOnHead.ts'],
      })
    ).toThrow('Changed audit target does not exist as a file');
  });
});
