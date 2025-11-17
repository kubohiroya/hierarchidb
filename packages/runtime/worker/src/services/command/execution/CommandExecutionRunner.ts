import type { CoreDB } from '../../CoreDB.js';
import type { CommandEnvelope, CommandResult } from '../../command-types.js';

/**
 * Wraps Dexie transaction execution for command handlers and coordinates
 * post-commit tasks that must run outside the transaction scope.
 */
export type PostCommitTask = () => Promise<void> | void;

export type CommandExecutionContext = {
  postCommitTasks: PostCommitTask[];
};

type GlobalTxFlags = typeof globalThis & {
  __HDB_FORCE_WORKER_TRANSACTIONS__?: boolean;
  __HDB_DISABLE_WORKER_TRANSACTIONS__?: boolean;
};

function detectFakeIndexedDB(): boolean {
  try {
    const factory = (globalThis as { indexedDB?: unknown }).indexedDB;
    if (!factory || typeof factory !== 'object') return false;
    const ctorName = (factory as { constructor?: { name?: unknown } }).constructor?.name;
    return ctorName === 'FDBFactory';
  } catch {
    return false;
  }
}

const NON_TRANSACTIONAL_COMMANDS = new Set(['commitWorkingCopy']);

function shouldUseTransactions(commandKind: string): boolean {
  if (NON_TRANSACTIONAL_COMMANDS.has(commandKind)) {
    return false;
  }
  const flags = globalThis as GlobalTxFlags;
  if (flags.__HDB_FORCE_WORKER_TRANSACTIONS__) {
    return true;
  }
  const disableByEnv = flags.__HDB_DISABLE_WORKER_TRANSACTIONS__ ?? detectFakeIndexedDB();
  return !disableByEnv;
}

export class CommandExecutionRunner {
  private static readonly TRANSACTION_TABLES: Array<
    'nodes' | 'trees' | 'rootStates' | 'tags' | 'tagAssociations'
  > = ['nodes', 'trees', 'rootStates', 'tags', 'tagAssociations'];

  constructor(private readonly coreDB: CoreDB) {}

  createContext(): CommandExecutionContext {
    return { postCommitTasks: [] };
  }

  async run<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
    execute: (context: CommandExecutionContext) => Promise<CommandResult>
  ): Promise<CommandResult> {
    let context = this.createContext();
    let pendingTasks: PostCommitTask[] = [];
    let result: CommandResult | undefined;
    let retriedWithoutTx = false;

    const runInTx =
      typeof this.coreDB.runInTx === 'function' ? this.coreDB.runInTx.bind(this.coreDB) : null;
    if (runInTx && shouldUseTransactions(envelope.kind)) {
      try {
        result = await runInTx('rw', CommandExecutionRunner.TRANSACTION_TABLES, () =>
          execute(context)
        );
      } catch (error) {
        if (this.isRetryableTransactionError(error)) {
          console.warn(
            '[CommandProcessor] Dexie transaction failed with PrematureCommitError; retrying without TX.'
          );
          pendingTasks = context.postCommitTasks.slice();
          retriedWithoutTx = true;
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      if (retriedWithoutTx) {
        context = this.createContext();
      }
      result = await execute(context);
      if (pendingTasks.length > 0) {
        context.postCommitTasks.push(...pendingTasks);
        pendingTasks = [];
      }
    }

    await this.runPostCommitTasks(result, context);
    return result;
  }

  private async runPostCommitTasks(
    result: CommandResult,
    context: CommandExecutionContext
  ): Promise<void> {
    if (!result.success || context.postCommitTasks.length === 0) {
      return;
    }

    for (const task of context.postCommitTasks) {
      try {
        await task();
      } catch (error) {
        console.warn('[CommandProcessor] post-commit task failed:', error);
      }
    }
  }

  private isRetryableTransactionError(error: unknown): boolean {
    if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
      return false;
    }
    const name = 'name' in error ? (error as { name?: unknown }).name : undefined;
    return typeof name === 'string' && name.toLowerCase() === 'prematurecommiterror';
  }
}
