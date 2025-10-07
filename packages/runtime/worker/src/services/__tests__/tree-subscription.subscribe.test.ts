import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type {
  NodeId,
  ObserveNodePayload,
  TreeChangeEvent,
  Timestamp,
} from '@hierarchidb/common-types';
import type { CommandEnvelope } from '../command-types.js';
import { TreeSubscriptionService } from '../TreeSubscriptionService.js';
import type { CoreDB } from '../CoreDB.js';

function createCoreStub(): CoreDB {
  const changeSubject = new Subject<TreeChangeEvent>();
  const core = {
    changeSubject,
    listChildren: vi.fn(async () => []),
    getNode: vi.fn(async () => undefined),
  } satisfies Partial<CoreDB> & { changeSubject: Subject<TreeChangeEvent> };

  return core as unknown as CoreDB;
}

describe('TreeSubscriptionService subscribe wrappers', () => {
  it('handles function observer subscribe/unsubscribe flow', async () => {
    const core = createCoreStub();
    const service = new TreeSubscriptionService(core);
    const nodeId = 'node-1' as NodeId;

    const cmd = {
      commandId: 'cmd-1',
      groupId: 'grp-1',
      kind: 'subscribeNode',
      payload: { nodeId, includeInitialValue: false } as ObserveNodePayload,
      issuedAt: Date.now() as Timestamp,
    } satisfies CommandEnvelope<'subscribeNode', ObserveNodePayload>;

    const observable = service.subscribeNodeCommand(cmd);
    const next = vi.fn();
    const subscription = observable.subscribe(next);

    expect(await service.getActiveSubscriptions()).toBe(1);

    const event: TreeChangeEvent = {
      type: 'node-updated',
      nodeId,
      timestamp: Date.now() as Timestamp,
    };

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ nodeId }));

    subscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await service.getActiveSubscriptions()).toBe(0);

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports observer object argument for subscribe', async () => {
    const core = createCoreStub();
    const service = new TreeSubscriptionService(core);
    const nodeId = 'node-2' as NodeId;

    const cmd = {
      commandId: 'cmd-2',
      groupId: 'grp-2',
      kind: 'subscribeNode',
      payload: { nodeId, includeInitialValue: false } as ObserveNodePayload,
      issuedAt: Date.now() as Timestamp,
    } satisfies CommandEnvelope<'subscribeNode', ObserveNodePayload>;

    const observable = service.subscribeNodeCommand(cmd);
    const observer = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    const subscription = observable.subscribe(observer);

    const event: TreeChangeEvent = {
      type: 'node-updated',
      nodeId,
      timestamp: Date.now() as Timestamp,
    };

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.next).toHaveBeenCalledWith(expect.objectContaining({ nodeId }));

    subscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.next).toHaveBeenCalledTimes(1);
    expect(await service.getActiveSubscriptions()).toBe(0);
  });
});
