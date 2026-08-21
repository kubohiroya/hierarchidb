import type { BuildProgress, BuildSessionStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { BaseBuildSessionManager } from '../../manager/BaseBuildSessionManager.js';
import { AbstractBuildSession } from '../AbstractBuildSession.js';

const NODE_ID = 'node-1' as NodeId;

class TestBuildSession extends AbstractBuildSession {
  reportProgress(partial: Partial<BuildProgress>): void {
    this.updateProgress(partial, 'source');
  }

  protected async processBatch(): Promise<void> {}
}

class PausableTestBuildSession extends AbstractBuildSession {
  pauseHookCalls = 0;

  constructor(nodeId: NodeId, private readonly notifyStarted: () => void) {
    super(nodeId, {});
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    this.notifyStarted();
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(createAbortError('test session paused')),
        { once: true }
      );
    });
  }

  protected override async onPause(): Promise<void> {
    this.pauseHookCalls += 1;
  }
}

class TestBuildSessionManager extends BaseBuildSessionManager {
  readonly updatedSessions: AbstractBuildSession[] = [];

  async startBuildSession(_nodeId: NodeId): Promise<BuildSessionStatus> {
    throw new Error('Not implemented for this unit test');
  }

  register(session: AbstractBuildSession): void {
    this.registerSession(session);
  }

  cleanup(nodeId: NodeId): void {
    this.cleanupSessionTracking(nodeId);
  }

  protected override async onSessionUpdated(session: AbstractBuildSession): Promise<void> {
    this.updatedSessions.push(session);
  }
}

describe('AbstractBuildSession session update notification', () => {
  it('notifies listeners without an aggregate event payload', () => {
    const session = new TestBuildSession(NODE_ID, {});
    const listener = vi.fn();
    const unsubscribe = session.addSessionUpdateListener(listener);

    session.reportProgress({ total: 4, completed: 1, failed: 1, skipped: 0 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith();
    expect(session.getProgress()).toMatchObject({
      total: 4,
      completed: 1,
      failed: 1,
      skipped: 0,
      percentage: 50,
    });

    unsubscribe();
    session.reportProgress({ completed: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects caller-supplied percentage and invalid task counts', () => {
    const session = new TestBuildSession(NODE_ID, {});

    expect(() => session.reportProgress({ percentage: 200 })).toThrow(
      /percentage is derived from task counts and must not be provided/
    );
    expect(() => session.reportProgress({ total: -1 })).toThrow(/total must be a non-negative integer/);
    expect(() =>
      session.reportProgress({ total: 1, completed: 1, failed: 1, skipped: 0 })
    ).toThrow(/terminal task count must not exceed total/);
  });

  it('releases the previous and final session listeners through manager tracking', () => {
    const manager = new TestBuildSessionManager();
    const first = new TestBuildSession(NODE_ID, {});
    const replacement = new TestBuildSession(NODE_ID, {});

    manager.register(first);
    first.reportProgress({ total: 1 });
    expect(manager.updatedSessions).toEqual([first]);

    manager.register(replacement);
    first.reportProgress({ total: 2 });
    replacement.reportProgress({ total: 1 });
    expect(manager.updatedSessions).toEqual([first, replacement]);

    manager.cleanup(NODE_ID);
    replacement.reportProgress({ total: 2 });
    expect(manager.updatedSessions).toEqual([first, replacement]);
  });

  it('settles the active run before publishing paused state', async () => {
    let notifyStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const session = new PausableTestBuildSession(NODE_ID, notifyStarted);
    const observedStatuses: BuildSessionStatus['status'][] = [];
    session.addSessionUpdateListener(() => {
      observedStatuses.push(session.getState().status);
    });

    const runPromise = session.start();
    await started;
    await expect(session.pause()).resolves.toBeUndefined();
    await expect(runPromise).resolves.toBeUndefined();

    expect(session.getState().status).toBe('paused');
    expect(session.pauseHookCalls).toBe(1);
    expect(observedStatuses).toEqual(['running', 'paused']);
  });
});

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
