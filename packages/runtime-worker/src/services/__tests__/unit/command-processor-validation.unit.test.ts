import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertCommandFailure } from '../../../test-utils/assertions.js';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';
import type { CommandEnvelope } from '../../command-types.js';
let coreDBStub: CoreDB;

beforeAll(async () => {
  coreDBStub = {} as Partial<CoreDB> as CoreDB;
});

afterAll(async () => {});

describe('CommandProcessor + envelope validation (ZE-3)', () => {
  it('returns VALIDATION_ERROR for invalid envelope', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const invalid = {
      payload: {},
      issuedAt: Date.now(),
      commandId: 'c',
      groupId: 'g',
    } as unknown as CommandEnvelope<string, Record<string, never>>; // missing kind/type
    const result = await cp.processCommand(invalid);
    assertCommandFailure(result);
    expect(result.code).toBe('VALIDATION_ERROR');
  });
});
