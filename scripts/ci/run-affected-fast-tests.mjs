import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_ROOTS = ['app', 'packages', 'plugins'];
const TEST_FILE_PATTERN =
  /(?:^|\/)(?:__tests__\/.*|.*)(?:\.unit|\.integration|\.property)?\.test\.[cm]?[tj]sx?$/u;
const SOURCE_FILE_PATTERN = /\.[cm]?[tj]sx?$/u;

const assertCommitSha = (value, variableName) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new TypeError(`${variableName} must be a lowercase 40-character commit SHA.`);
  }
};

const assertRepositoryPath = (filePath) => {
  if (
    typeof filePath !== 'string' ||
    filePath.length === 0 ||
    filePath.startsWith('/') ||
    filePath.includes('\\') ||
    filePath.split('/').includes('..') ||
    filePath.includes('\0')
  ) {
    throw new TypeError(`Invalid repository-relative path: ${JSON.stringify(filePath)}`);
  }
};

export const readChangedPaths = ({ baseSha, headSha, cwd = process.cwd() }) => {
  assertCommitSha(baseSha, 'TURBO_SCM_BASE');
  assertCommitSha(headSha, 'TURBO_SCM_HEAD');
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
  return output
    .toString('utf8')
    .split('\0')
    .filter((filePath) => filePath.length > 0);
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const listFiles = (directoryPath) => {
  const result = [];
  const visit = (currentPath) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
      } else if (entry.isFile()) {
        result.push(nextPath);
      }
    }
  };
  visit(directoryPath);
  return result;
};

export const findPackageRoot = ({ filePath, cwd = process.cwd() }) => {
  assertRepositoryPath(filePath);
  const [workspaceRoot] = filePath.split('/');
  if (workspaceRoot === undefined || !WORKSPACE_ROOTS.includes(workspaceRoot)) return null;

  let currentPath = path.join(cwd, path.dirname(filePath));
  const repositoryRoot = path.resolve(cwd);
  while (currentPath.startsWith(repositoryRoot)) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      return path.relative(cwd, currentPath) || '.';
    }
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }
  return null;
};

const stripSourceExtension = (filePath) => path.basename(filePath).replace(/\.[cm]?[tj]sx?$/u, '');

const isTestFile = (filePath) => TEST_FILE_PATTERN.test(filePath);

const isRunnableSourceFile = (filePath) =>
  SOURCE_FILE_PATTERN.test(filePath) && !filePath.endsWith('.d.ts');

export const selectRelatedTests = ({ changedPaths, cwd = process.cwd() }) => {
  const packages = new Map();
  for (const changedPath of changedPaths) {
    assertRepositoryPath(changedPath);
    const packageRoot = findPackageRoot({ filePath: changedPath, cwd });
    if (packageRoot === null) continue;
    const absolutePackageRoot = path.join(cwd, packageRoot);
    const packageJsonPath = path.join(absolutePackageRoot, 'package.json');
    if (!existsSync(packageJsonPath)) continue;
    const packageJson = readJson(packageJsonPath);
    const packageName = packageJson.name;
    if (typeof packageName !== 'string' || packageName.length === 0) continue;
    const entry = packages.get(packageRoot) ?? {
      packageName,
      packageRoot,
      hasTestScript: typeof packageJson.scripts?.test === 'string',
      changedFiles: [],
      relatedTests: new Set(),
    };
    entry.changedFiles.push(changedPath);
    packages.set(packageRoot, entry);
  }

  for (const entry of packages.values()) {
    const absolutePackageRoot = path.join(cwd, entry.packageRoot);
    const packageTests = listFiles(absolutePackageRoot)
      .map((absolutePath) => path.relative(cwd, absolutePath))
      .filter(isTestFile);

    for (const changedPath of entry.changedFiles) {
      if (isTestFile(changedPath) && existsSync(path.join(cwd, changedPath))) {
        entry.relatedTests.add(changedPath);
        continue;
      }
      if (!isRunnableSourceFile(changedPath)) continue;
      const changedBaseName = stripSourceExtension(changedPath);
      for (const testPath of packageTests) {
        const testBaseName = stripSourceExtension(testPath);
        if (testBaseName.includes(changedBaseName) || testPath.includes(`/${changedBaseName}.`)) {
          entry.relatedTests.add(testPath);
        }
      }
    }
  }

  return [...packages.values()].map((entry) => ({
    packageName: entry.packageName,
    packageRoot: entry.packageRoot,
    hasTestScript: entry.hasTestScript,
    changedFiles: [...entry.changedFiles],
    relatedTests: [...entry.relatedTests].sort(),
  }));
};

const runPackageFastTests = ({ command, cwd, selection }) =>
  new Promise((resolve, reject) => {
    console.error(
      `[ci-validation] fast tests for ${selection.packageName}: ${selection.relatedTests.join(', ')}`
    );
    const args = [
      '--dir',
      selection.packageRoot,
      'run',
      'test',
      ...selection.relatedTests.map((testPath) => path.relative(selection.packageRoot, testPath)),
    ];
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Fast test validation terminated by signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });

export const runAffectedFastTests = async ({
  baseSha = process.env.TURBO_SCM_BASE,
  headSha = process.env.TURBO_SCM_HEAD,
  cwd = process.cwd(),
} = {}) => {
  const selections = selectRelatedTests({
    changedPaths: readChangedPaths({ baseSha, headSha, cwd }),
    cwd,
  });
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const runnableSelections = [];
  for (const selection of selections) {
    if (selection.relatedTests.length === 0) {
      console.error(
        `[ci-validation] no related tests selected for ${selection.packageName}; PR fast test is skipped for changed files: ${selection.changedFiles.join(', ')}`
      );
      continue;
    }
    if (!selection.hasTestScript) {
      console.error(
        `[ci-validation] related tests selected for ${selection.packageName}, but ${selection.packageRoot}/package.json has no test script; PR fast test is skipped for selected tests: ${selection.relatedTests.join(', ')}`
      );
      continue;
    }
    runnableSelections.push(selection);
  }
  for (const selection of runnableSelections) {
    const exitCode = await runPackageFastTests({ command, cwd, selection });
    if (exitCode !== 0) {
      return exitCode;
    }
  }
  return 0;
};

const isCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  try {
    process.exitCode = await runAffectedFastTests();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ci-validation] ${message}`);
    process.exitCode = 1;
  }
}
