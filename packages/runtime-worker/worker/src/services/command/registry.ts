import type { CommandEnvelope } from '../command-types';
import type { Seq } from '@hierarchidb/common-type';

// Minimal command handler interfaces and registry implementation.
// Keeps behavior identical to the previous switch-case logic while
// making command execution pluggable and easier to maintain.

export type CommandHandlerContext<TType extends string, TPayload> = {
  envelope: CommandEnvelope<TType, TPayload>;
  nextSeq: () => Seq;
};

export interface CommandHandler<TType extends string = string, TPayload = unknown> {
  validate?: (payload: TPayload) => boolean | Promise<boolean>;
  execute: (
    ctx: CommandHandlerContext<TType, TPayload>
  ) => Promise<import('../command-types').CommandResult>;
  undo?: (ctx: CommandHandlerContext<TType, TPayload>) => Promise<void>;
  redo?: (ctx: CommandHandlerContext<TType, TPayload>) => Promise<void>;
}

class CommandRegistry {
  private handlers = new Map<string, CommandHandler<any, any>>();

  register<TType extends string, TPayload>(
    type: TType,
    handler: CommandHandler<TType, TPayload>
  ): void {
    this.handlers.set(type, handler as CommandHandler<any, any>);
  }

  get(type: string): CommandHandler | undefined {
    return this.handlers.get(type);
  }
}

export const commandRegistry = new CommandRegistry();

// Register minimal default handlers to preserve existing behavior.
// These mimic the legacy switch-case responses.
const successOnlyHandler: CommandHandler = {
  execute: async ({ nextSeq }) => ({ success: true, seq: nextSeq() }),
};

commandRegistry.register('ping', successOnlyHandler);
commandRegistry.register('test', successOnlyHandler);
commandRegistry.register('bulkCreate', successOnlyHandler);

// Intentionally do not register create/update here so CommandProcessor
// uses its legacy fallback which performs real CoreDB operations.

// Note: we intentionally do NOT register 'invalidCommand' to keep validation consistent.
