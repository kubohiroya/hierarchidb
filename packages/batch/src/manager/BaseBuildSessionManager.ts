import type { NodeId } from '@hierarchidb/core-types';
import type {
  BuildProgressCallback,
  BuildProgressEvent,
  BuildSessionStatus,
  IBuildSessionManager,
} from '@hierarchidb/batch-api';
import { isBuildControlAPIV2Enabled } from '@hierarchidb/batch-api';
import type { AbstractBuildSession } from '../session/AbstractBuildSession';

/**
 * Base implementation for plugin build session managers.
 * It tracks in-memory sessions and forwards progress callbacks.
 */
export abstract class BaseBuildSessionManager implements IBuildSessionManager {
  protected sessions = new Map<NodeId, AbstractBuildSession>();
  protected progressCallbacks = new Map<NodeId, Set<BuildProgressCallback>>();
  private sessionProgressTeardown = new Map<NodeId, () => void>();
  private lastPhaseBySession = new Map<NodeId, BuildProgressEvent['phase']>();

  abstract startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus>;

  protected async onSessionRegistered(_session: AbstractBuildSession): Promise<void> {}
  protected async onSessionProgress(_session: AbstractBuildSession, _event: BuildProgressEvent): Promise<void> {}
  protected async onSessionStatusChange(_session: AbstractBuildSession): Promise<void> {}
  protected cleanupSessionTracking(nodeId: NodeId): void {
    this.lastPhaseBySession.delete(nodeId);
  }

  async pauseBuildSession(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await session.pause();
    await this.onSessionStatusChange(session);
  }

  async resumeBuildSession(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await session.resume();
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
    };
  }

  onBuildProgress(nodeId: NodeId, callback: BuildProgressCallback): () => void {
    let callbacks = this.progressCallbacks.get(nodeId);
    if (!callbacks) {
      callbacks = new Set();
      this.progressCallbacks.set(nodeId, callbacks);
    }
    callbacks.add(callback);

    return () => {
      const cbs = this.progressCallbacks.get(nodeId);
      if (!cbs) return;
      cbs.delete(callback);
      if (cbs.size === 0) {
        this.progressCallbacks.delete(nodeId);
      }
    };
  }

  protected emitProgress(nodeId: NodeId, event: BuildProgressEvent): void {
    const callbacks = this.progressCallbacks.get(nodeId);
    if (!callbacks) return;
    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  protected registerSession(session: AbstractBuildSession): void {
    const nodeId = session.getState().nodeId as NodeId;
    this.sessions.set(nodeId, session);
    void this.onSessionRegistered(session);

    const teardown = this.sessionProgressTeardown.get(nodeId);
    if (teardown) {
      teardown();
      this.sessionProgressTeardown.delete(nodeId);
    }

    const shouldEmit = isBuildControlAPIV2Enabled();
    const unsubscribe = session.addBuildProgressListener((event: BuildProgressEvent) => {
      if (shouldEmit) {
        this.emitProgress(nodeId, event);
      }
      void this.onSessionProgress(session, event);
      const lastPhase = this.lastPhaseBySession.get(nodeId);
      if (event.phase !== lastPhase) {
        this.lastPhaseBySession.set(nodeId, event.phase);
        void this.onSessionStatusChange(session);
      }
    });
    this.sessionProgressTeardown.set(nodeId, unsubscribe);
  }
}
