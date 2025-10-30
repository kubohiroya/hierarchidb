import { describe, expect, it } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';
import { assertCommandFailure } from '../../test-utils/assertions.js';

// Minimal CoreDB stub to satisfy constructor; not used on validation failure path
const coreDBStub: any = {};

describe('CommandProcessor + envelope validation (ZE-3)', () => {
  it('returns VALIDATION_ERROR for invalid envelope', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const invalid: any = { payload: {}, issuedAt: Date.now(), commandId: 'c', groupId: 'g' }; // missing kind/type
    const result = await cp.processCommand(invalid);
    assertCommandFailure(result);
    expect(result.code).toBe('VALIDATION_ERROR');
  });
});
