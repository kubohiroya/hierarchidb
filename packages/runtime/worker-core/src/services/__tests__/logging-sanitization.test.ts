import { describe, expect, it } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';

const coreDBStub: any = {};

describe('ZE-4: logging and event sanitization', () => {
  it('does not record event for validation failure', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const invalid: any = { commandId: 'c', groupId: 'g', payload: {}, issuedAt: Date.now() };
    const result = await cp.processCommand(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('VALIDATION_ERROR');
    expect(cp.getLastEvent()).toBeUndefined();
  });

  it('records event without leaking payload', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const ok: any = {
      commandId: 'c2',
      groupId: 'g2',
      kind: 'ping',
      payload: { secret: 'should-not-appear-in-event' },
      issuedAt: Date.now(),
    };
    const result = await cp.processCommand(ok);
    expect(result.success).toBe(true);
    const evt = cp.getLastEvent();
    expect(evt).toBeDefined();
    if (evt) {
      const text = JSON.stringify(evt);
      expect(text).not.toContain('secret');
    }
  });
});
