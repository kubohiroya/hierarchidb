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

export class CommandExecutionRunner {
  private static readonly NON_TRANSACTIONAL_COMMANDS = new Set(['commitWorkingCopy']);
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
    let result: CommandResult | undefined;
    let retriedWithoutTx = false;

    const runInTx =
      typeof this.coreDB.runInTx === 'function' ? this.coreDB.runInTx.bind(this.coreDB) : null;
    if (runInTx && !CommandExecutionRunner.NON_TRANSACTIONAL_COMMANDS.has(envelope.kind)) {
      try {
        result = await runInTx('rw', CommandExecutionRunner.TRANSACTION_TABLES, () =>
          execute(context)
        );
      } catch (error) {
        if (this.isRetryableTransactionError(error)) {
          console.warn(
            '[CommandProcessor] Dexie transaction failed with PrematureCommitError; retrying without TX.'
          );
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
