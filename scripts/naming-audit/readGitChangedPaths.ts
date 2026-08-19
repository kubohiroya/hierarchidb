import { execFileSync } from 'node:child_process';

export interface ReadGitChangedPathsOptions {
  readonly cwd?: string;
  readonly headRef?: string;
}

/**
 * Read repository-relative paths added, copied, modified, or renamed since a base ref.
 * Deleted paths are intentionally excluded because there is no file left to audit.
 */
export function readGitChangedPaths(
  baseRef: string,
  options: ReadGitChangedPathsOptions = {}
): string[] {
  if (baseRef.length === 0) {
    throw new Error('The changed-file base ref must not be empty.');
  }

  const headRef = options.headRef ?? 'HEAD';
  const output = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '-z',
      '--diff-filter=ACMR',
      '--find-renames',
      '--find-copies',
      `${baseRef}...${headRef}`,
      '--',
    ],
    {
      cwd: options.cwd ?? process.cwd(),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }
  );

  return output
    .split('\0')
    .filter((filePath) => filePath.length > 0)
    .map((filePath) => filePath.replace(/\\/g, '/'));
}
