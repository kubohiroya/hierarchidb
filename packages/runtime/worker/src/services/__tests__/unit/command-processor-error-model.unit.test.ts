import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { assertCommandFailure } from '../../../test-utils/assertions.js';
import { CommandProcessor } from '../../CommandProcessor.js';
import { CoreDB } from '../../CoreDB.js';
import { commandRegistry } from '../../command/registry.js';
import { WorkerErrorCode } from '../../command-types.js';

describe('CommandProcessor error model', () => {
  let core: CoreDB;
  let processor: CommandProcessor;

  beforeEach(async () => {
    core = await CoreDB.getSingleton();
    processor = new CommandProcessor(core);
  });

  it('sanitizes thrown error messages and maps them to UNKNOWN_ERROR by default', async () => {
    const commandName = 'error-model-test-unknown';
    commandRegistry.register(commandName, {
      execute: async () => {
        throw new Error('line1\nline2 with extra\twhitespace');
      },
    });

    const envelope = processor.createEnvelope(commandName, {} as Record<string, never>);
    const result = await processor.processCommand(envelope);

    assertCommandFailure(result);
    expect(result.code).toBe(WorkerErrorCode.UNKNOWN_ERROR);
    expect(result.error).toBe('line1 line2 with extra whitespace');
    expect(result.seq).toBeDefined();
  });

  it('classifies Dexie-style constraint errors as DATABASE_ERROR', async () => {
    const commandName = 'error-model-test-database';
    class FakeConstraintError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ConstraintError';
      }
    }

    commandRegistry.register(commandName, {
      execute: async () => {
        throw new FakeConstraintError('Constraint failure: unique index violated');
      },
    });

    const envelope = processor.createEnvelope(commandName, {} as Record<string, never>);
    const result = await processor.processCommand(envelope);

    assertCommandFailure(result);
    expect(result.code).toBe(WorkerErrorCode.DATABASE_ERROR);
    expect(result.error).toBe('Constraint failure: unique index violated');
  });
});
