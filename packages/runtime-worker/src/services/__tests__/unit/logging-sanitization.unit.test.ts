import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TreeChangeEvent } from '@hierarchidb/tree-api';
import { Subject } from 'rxjs';
import { CommandProcessor } from '../../CommandProcessor';
import type { CoreDB } from '../../CoreDB';
import type { CommandEnvelope } from '../../command-types';

let coreDBStub: CoreDB;

beforeAll(async () => {
  coreDBStub = {
    changeSubject: new Subject<TreeChangeEvent>(),
  } as Partial<CoreDB> as CoreDB;
});

afterAll(async () => {
  // fulltext tables removed; no-op
});

describe('ZE-4: logging and event sanitization', () => {
  it('does not record event for validation failure', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const invalid = {
      commandId: 'c',
      groupId: 'g',
      payload: {},
      issuedAt: Date.now(),
    } as unknown as CommandEnvelope<string, Record<string, never>>;
    const result = await cp.processCommand(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const code = 'code' in result ? result.code : undefined;
      expect(code).toBe('VALIDATION_ERROR');
    }
    expect(cp.getLastEvent()).toBeUndefined();
  });

  it('records event without leaking payload', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const ok = {
      commandId: 'c2',
      groupId: 'g2',
      kind: 'ping',
      payload: { secret: 'should-not-appear-in-event' },
      issuedAt: Date.now(),
    } as unknown as CommandEnvelope<'ping', { secret: string }>;
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
