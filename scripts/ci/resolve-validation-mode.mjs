import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DOCUMENTATION_DIRECTORIES = ['.kiro/', 'docs/', 'plans/', 'reports/'];
const WORKSPACE_DIRECTORIES = ['app/', 'packages/', 'plugins/'];
const LOCKFILE_PATHS = new Set(['pnpm-lock.yaml']);
const CI_IGNORED_PATHS = new Set([
  '.github/workflows/naming-audit.yml',
  '.github/workflows/naming-audit-baseline.yml',
  'scripts/naming-audit-baseline.json',
]);

const assertRepositoryPath = (filePath) => {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('Changed paths must be non-empty strings.');
  }
  if (
    filePath.startsWith('/') ||
    filePath.includes('\\') ||
    filePath.split('/').includes('..') ||
    filePath.includes('\0')
  ) {
    throw new TypeError(`Invalid repository-relative path: ${JSON.stringify(filePath)}`);
  }
};

const isDocumentationOnlyPath = (filePath) =>
  filePath === 'LICENSE' ||
  CI_IGNORED_PATHS.has(filePath) ||
  filePath.endsWith('.md') ||
  DOCUMENTATION_DIRECTORIES.some((directory) => filePath.startsWith(directory));

const isWorkspacePath = (filePath) =>
  WORKSPACE_DIRECTORIES.some((directory) => filePath.startsWith(directory));

const isLockfilePath = (filePath) => LOCKFILE_PATHS.has(filePath);

export const classifyChangedPaths = (changedPaths) => {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    throw new TypeError('At least one changed path is required.');
  }
  changedPaths.forEach(assertRepositoryPath);

  const validationPaths = changedPaths.filter((filePath) => !isDocumentationOnlyPath(filePath));
  if (validationPaths.length === 0) {
    return {
      mode: 'skip',
      reason: 'All changed files are documentation-only paths.',
    };
  }

  const nonLockfileValidationPaths = validationPaths.filter(
    (filePath) => !isLockfilePath(filePath)
  );
  const fullValidationPaths = nonLockfileValidationPaths.filter(
    (filePath) => !isWorkspacePath(filePath)
  );
  if (fullValidationPaths.length > 0) {
    return {
      mode: 'full',
      reason: `Repository-wide inputs changed: ${fullValidationPaths.join(', ')}`,
    };
  }

  return {
    mode: 'affected',
    reason:
      nonLockfileValidationPaths.length === 0
        ? `Lockfile-only changes detected: ${validationPaths.join(', ')}`
        : `Workspace-local changes detected: ${validationPaths.join(', ')}`,
  };
};

const assertCommitSha = (value, optionName) => {
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new TypeError(`${optionName} must be a lowercase 40-character commit SHA.`);
  }
};

export const readChangedPaths = ({ baseSha, headSha, cwd = process.cwd() }) => {
  assertCommitSha(baseSha, '--base');
  assertCommitSha(headSha, '--head');

  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', baseSha, headSha, '--'],
    {
      cwd,
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );
  const changedPaths = output
    .toString('utf8')
    .split('\0')
    .filter((filePath) => filePath.length > 0);
  if (changedPaths.length === 0) {
    throw new Error(`No changed files found between ${baseSha} and ${headSha}.`);
  }
  return changedPaths;
};

const parseCliArguments = (args) => {
  if (args.length !== 4 || args[0] !== '--base' || args[2] !== '--head') {
    throw new TypeError('Usage: resolve-validation-mode.mjs --base <sha> --head <sha>');
  }
  const baseSha = args[1];
  const headSha = args[3];
  if (baseSha === undefined || headSha === undefined) {
    throw new TypeError('Both --base and --head are required.');
  }
  return { baseSha, headSha };
};

const isCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  try {
    const refs = parseCliArguments(process.argv.slice(2));
    const result = classifyChangedPaths(readChangedPaths(refs));
    console.error(`[ci-validation] ${result.reason}`);
    process.stdout.write(`${result.mode}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ci-validation] ${message}`);
    process.exitCode = 1;
  }
}
