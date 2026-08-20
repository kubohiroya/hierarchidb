import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const assertCommitSha = (value, variableName) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new TypeError(`${variableName} must be a lowercase 40-character commit SHA.`);
  }
};

export const createTurboArguments = ({ baseSha, headSha }) => {
  assertCommitSha(baseSha, 'TURBO_SCM_BASE');
  assertCommitSha(headSha, 'TURBO_SCM_HEAD');
  return [
    'exec',
    'turbo',
    'run',
    'build',
    'typecheck',
    'test',
    'lint',
    '--filter',
    `[${baseSha}...${headSha}]`,
    '--log-order=grouped',
    '--output-logs=errors-only',
  ];
};

export const runAffectedValidation = ({
  baseSha = process.env.TURBO_SCM_BASE,
  headSha = process.env.TURBO_SCM_HEAD,
} = {}) => {
  const args = createTurboArguments({ baseSha, headSha });
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.signal !== null) {
    throw new Error(`Affected validation terminated by signal ${result.signal}.`);
  }
  if (result.status === null) {
    throw new Error('Affected validation exited without a status code.');
  }
  return result.status;
};

const isCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  try {
    process.exitCode = runAffectedValidation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ci-validation] ${message}`);
    process.exitCode = 1;
  }
}
