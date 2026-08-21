import type { NodeId } from '@hierarchidb/core-types';
import type {
  BuildSessionStatusValue,
  BuildSessionStatus,
  IBuildSessionManager,
} from '@hierarchidb/build-api';
import type { AbstractBuildSession } from '../session/AbstractBuildSession';

/**
 * Base implementation for plugin build session managers.
 * It tracks in-memory sessions and notifies subclasses when session state changes.
 */
export abstract class BaseBuildSessionManager implements IBuildSessionManager {
  protected sessions = new Map<NodeId, AbstractBuildSession>();
  private sessionUpdateTeardown = new Map<NodeId, () => void>();
  private lastStatusBySession = new Map<NodeId, BuildSessionStatusValue>();

  abstract startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus>;

  protected async onSessionRegistered(_session: AbstractBuildSession): Promise<void> {}
  protected async onSessionUpdated(_session: AbstractBuildSession): Promise<void> {}
  protected async onSessionStatusChange(_session: AbstractBuildSession): Promise<void> {}
  protected cleanupSessionTracking(nodeId: NodeId): void {
    this.sessionUpdateTeardown.get(nodeId)?.();
    this.sessionUpdateTeardown.delete(nodeId);
    this.lastStatusBySession.delete(nodeId);
  }

  async pauseBuildSession(nodeId: NodeId, reason?: string): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await session.pause(reason);
    await this.onSessionStatusChange(session);
  }

  async cancelQueuedBuildSession(nodeId: NodeId, reason?: string): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    const status = session.getState().status;
    if (status === 'running') {
      await this.pauseBuildSession(nodeId, reason);
      return;
    }
    if (status !== 'queued') {
      throw new Error(`Cannot cancel session from state ${status}`);
    }
    await session.cancelQueued(reason);
    await this.onSessionStatusChange(session);
  }

  async getBuildSessionStatus(nodeId: NodeId): Promise<BuildSessionStatus> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }

    const state = session.getState();
    const progress = session.getProgress();

    return {
      nodeId: state.nodeId,
      status: state.status,
      progress,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      lastActivity: state.lastActivity,
      error: state.error,
      stopReason: state.stopReason,
    };
  }

  protected registerSession(session: AbstractBuildSession): void {
    const nodeId = session.getState().nodeId as NodeId;
    this.sessions.set(nodeId, session);
    void this.onSessionRegistered(session);

    const teardown = this.sessionUpdateTeardown.get(nodeId);
    if (teardown) {
      teardown();
      this.sessionUpdateTeardown.delete(nodeId);
    }

    const unsubscribe = session.addSessionUpdateListener(() => {
      void this.onSessionUpdated(session);
      const status = session.getState().status;
      const lastStatus = this.lastStatusBySession.get(nodeId);
      if (status !== lastStatus) {
        this.lastStatusBySession.set(nodeId, status);
        void this.onSessionStatusChange(session);
      }
    });
    this.sessionUpdateTeardown.set(nodeId, unsubscribe);
  }
}
