import type { CommandResult, CommitResult } from '@hierarchidb/common-types';

export type CommandResultSuccess = Extract<CommandResult, { success: true }>;
export type CommandResultFailure = Extract<CommandResult, { success: false }>;

export function assertCommandSuccess(
  result: CommandResult,
  context?: string
): asserts result is CommandResultSuccess {
  if (!result.success) {
    const prefix = context ? `${context}: ` : '';
    const code = 'code' in result ? result.code : 'UNKNOWN_ERROR';
    const error = 'error' in result ? result.error : 'unknown error';
    throw new Error(`${prefix}Expected success but received ${code} (${error})`);
  }
}

export function assertCommandFailure(
  result: CommandResult,
  context?: string
): asserts result is CommandResultFailure {
  if (result.success) {
    const prefix = context ? `${context}: ` : '';
    const seq = 'seq' in result ? result.seq : 'n/a';
    throw new Error(`${prefix}Expected failure but received success (seq=${seq})`);
  }
}

export type CommitOk = Extract<CommitResult, { status: 'ok' }>;
export type CommitNameConflict = Extract<CommitResult, { status: 'NAME_CONFLICT' }>;
export type CommitConflict = Extract<CommitResult, { status: 'COMMIT_CONFLICT' }>;

export function assertCommitOk(result: CommitResult, context?: string): asserts result is CommitOk {
  if (result.status !== 'ok') {
    const prefix = context ? `${context}: ` : '';
    throw new Error(`${prefix}Expected commit ok but received status ${result.status}`);
  }
}

export function assertCommitNameConflict(
  result: CommitResult,
  context?: string
): asserts result is CommitNameConflict {
  if (result.status !== 'NAME_CONFLICT') {
    const prefix = context ? `${context}: ` : '';
    throw new Error(`${prefix}Expected NAME_CONFLICT but received status ${result.status}`);
  }
}

export function assertCommitConflict(
  result: CommitResult,
  context?: string
): asserts result is CommitConflict {
  if (result.status !== 'COMMIT_CONFLICT') {
    const prefix = context ? `${context}: ` : '';
    throw new Error(`${prefix}Expected COMMIT_CONFLICT but received status ${result.status}`);
  }
}
