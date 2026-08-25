import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const assertCommitSha = (value, variableName) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new TypeError(`${variableName} must be a lowercase 40-character commit SHA.`);
  }
};

export const createTurboArguments = ({ baseSha, headSha, tasks: explicitTasks }) => {
  assertCommitSha(baseSha, 'TURBO_SCM_BASE');
  assertCommitSha(headSha, 'TURBO_SCM_HEAD');
  const tasks =
    explicitTasks ??
    (process.env.CI_AFFECTED_TASKS ?? 'typecheck')
      .split(',')
      .map((task) => task.trim())
      .filter((task) => task.length > 0);
  if (tasks.length === 0) {
    throw new Error('CI_AFFECTED_TASKS must contain at least one Turbo task.');
  }
  return [
    'exec',
    'turbo',
    'run',
    ...tasks,
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
  console.error(
    `[ci-validation] affected Turbo tasks: ${args.slice(3, args.indexOf('--filter')).join(', ')}`
  );
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
