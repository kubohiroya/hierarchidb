import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { assertCommandFailure } from '../../../test-utils/assertions';
import { CommandProcessor } from '../../CommandProcessor';
import { CoreDB } from '../../CoreDB';
import { commandRegistry } from '../../command/commandRegistry';
import { WorkerErrorCodeValue } from '../../WorkerErrorCodeValue';
import { getDBName } from '@hierarchidb/util';

describe('CommandProcessor error model', () => {
  let core: CoreDB;
  let processor: CommandProcessor;

  beforeEach(async () => {
    core = await CoreDB.getSingleton(getDBName('test', 'core'));
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
    expect(result.code).toBe(WorkerErrorCodeValue.UNKNOWN_ERROR);
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
    expect(result.code).toBe(WorkerErrorCodeValue.DATABASE_ERROR);
    expect(result.error).toBe('Constraint failure: unique index violated');
  });
});
