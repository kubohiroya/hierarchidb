import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TreeChangeEvent } from '@hierarchidb/tree-api';
import { Subject } from 'rxjs';
import { assertCommandFailure } from '../../../test-utils/assertions';
import { CommandProcessor } from '../../CommandProcessor';
import type { CoreDB } from '../../CoreDB';
import type { CommandEnvelope } from '../../WorkerErrorCodeValue';

let coreDBStub: CoreDB;

beforeAll(async () => {
  coreDBStub = {
    changeSubject: new Subject<TreeChangeEvent>(),
  } as Partial<CoreDB> as CoreDB;
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
    } as CommandEnvelope<string, Record<string, never>>; // missing kind/type
    const result = await cp.processCommand(invalid);
    assertCommandFailure(result);
    expect(result.code).toBe('VALIDATION_ERROR');
  });
});
