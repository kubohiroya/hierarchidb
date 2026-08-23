import { type AbstractBuildSession, BaseBuildSessionManager } from '@hierarchidb/build';
import type {
  BuildSessionStatus,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { createSessionStatusUpdatedPayload } from './createSessionStatusUpdatedPayload.js';
import { emitSessionStatusUpdated } from './emitSessionStatusUpdated.js';
import { emitStageSnapshotUpdated } from './emitStageSnapshotUpdated.js';
import { emitHeartbeat, emitTaskProgressUpdated } from './eventEmissionUtils.js';

export interface CanonicalBuildSessionEventSource {
  getCanonicalStageSnapshot(): StageSnapshotUpdatedEvent['payload'] | null;
  takeCanonicalTaskProgressUpdates(): TaskProgressUpdatedEvent['payload'][];
}

type CanonicalSession = AbstractBuildSession & CanonicalBuildSessionEventSource;

export abstract class CanonicalBuildSessionManager extends BaseBuildSessionManager {
  private readonly heartbeatTimers = new Map<NodeId, ReturnType<typeof setInterval>>();
  private readonly lastSessionStatusPayload = new Map<NodeId, string>();
  private readonly lastStageSnapshotPayload = new Map<NodeId, Map<string, string>>();
  private readonly runtimeSessionListeners = new Set<() => void>();

  protected override onSessionRegistered(session: AbstractBuildSession): Promise<void> {
    this.publishCanonicalState(requireCanonicalSession(session), true);
    this.notifyRuntimeSessionListeners();
    return Promise.resolve();
  }

  protected override onSessionUpdated(session: AbstractBuildSession): Promise<void> {
    this.publishCanonicalState(requireCanonicalSession(session), true);
    this.notifyRuntimeSessionListeners();
    return Promise.resolve();
  }

  protected override onSessionStatusChange(session: AbstractBuildSession): Promise<void> {
    this.publishSessionStatus(requireCanonicalSession(session));
    return Promise.resolve();
  }

  protected override cleanupSessionTracking(nodeId: NodeId): void {
    super.cleanupSessionTracking(nodeId);
    this.stopHeartbeat(nodeId);
    this.lastSessionStatusPayload.delete(nodeId);
    this.lastStageSnapshotPayload.delete(nodeId);
    this.notifyRuntimeSessionListeners();
  }

  async getBuildSessionRuntimeStatus(nodeId: NodeId): Promise<BuildSessionStatus | null> {
    return this.sessions.has(nodeId) ? this.getBuildSessionStatus(nodeId) : null;
  }

  async listBuildSessionRuntimeStatuses(): Promise<BuildSessionStatus[]> {
    const nodeIds = Array.from(this.sessions.keys()).sort((left, right) =>
      String(left).localeCompare(String(right))
    );
    return Promise.all(nodeIds.map((nodeId) => this.getBuildSessionStatus(nodeId)));
  }

  async deleteBuildSessionRuntime(nodeId: NodeId): Promise<void> {
    const session = this.sessions.get(nodeId);
    if (!session) return;
    const state = session.getState();
    if (session.hasActiveRun() || state.status === 'running' || state.status === 'pausing') {
      throw new Error(`Cannot delete an active build session for node ${String(nodeId)}.`);
    }
    await this.cleanupDeletedBuildSessionRuntime(nodeId, session);
    this.sessions.delete(nodeId);
    this.cleanupSessionTracking(nodeId);
  }

  subscribeBuildSessionRuntimeChanges(listener: () => void): () => void {
    this.runtimeSessionListeners.add(listener);
    return () => {
      this.runtimeSessionListeners.delete(listener);
    };
  }

  protected cleanupDeletedBuildSessionRuntime(
    _nodeId: NodeId,
    _session: AbstractBuildSession
  ): Promise<void> {
    return Promise.resolve();
  }

  private publishCanonicalState(session: CanonicalSession, includeStageSnapshot: boolean): void {
    const stageSnapshot = session.getCanonicalStageSnapshot();
    this.publishSessionStatus(session, stageSnapshot);

    for (const progress of session.takeCanonicalTaskProgressUpdates()) {
      emitTaskProgressUpdated(
        session.getState().nodeId,
        progress.taskId,
        progress.version,
        progress.stageId,
        progress.value,
        progress.message,
        progress.metadata
      );
    }

    if (includeStageSnapshot && stageSnapshot) {
      this.publishStageSnapshot(session.getState().nodeId, stageSnapshot);
    }
  }

  private publishStageSnapshot(
    nodeId: NodeId,
    payload: StageSnapshotUpdatedEvent['payload']
  ): void {
    let stagePayloads = this.lastStageSnapshotPayload.get(nodeId);
    if (!stagePayloads) {
      stagePayloads = new Map<string, string>();
      this.lastStageSnapshotPayload.set(nodeId, stagePayloads);
    }
    const fingerprint = JSON.stringify(payload);
    if (stagePayloads.get(payload.stageId) === fingerprint) return;
    emitStageSnapshotUpdated(nodeId, payload);
    stagePayloads.set(payload.stageId, fingerprint);
  }

  private publishSessionStatus(
    session: CanonicalSession,
    stageSnapshot: StageSnapshotUpdatedEvent['payload'] | null = session.getCanonicalStageSnapshot()
  ): void {
    const payload = createSessionStatusUpdatedPayload(session.getState(), stageSnapshot);
    const nodeId = payload.nodeId;
    const fingerprint = JSON.stringify(payload);
    if (this.lastSessionStatusPayload.get(nodeId) !== fingerprint) {
      emitSessionStatusUpdated(payload);
      this.lastSessionStatusPayload.set(nodeId, fingerprint);
    }
    this.syncHeartbeat(nodeId, payload.isActive);
  }

  private syncHeartbeat(nodeId: NodeId, isActive: boolean): void {
    const timer = this.heartbeatTimers.get(nodeId);
    if (!isActive) {
      if (timer) this.stopHeartbeat(nodeId);
      return;
    }
    if (timer) return;

    emitHeartbeat(nodeId, Date.now());
    const nextTimer = setInterval(() => {
      emitHeartbeat(nodeId, Date.now());
    }, 1_000);
    this.heartbeatTimers.set(nodeId, nextTimer);
  }

  private stopHeartbeat(nodeId: NodeId): void {
    const timer = this.heartbeatTimers.get(nodeId);
    if (!timer) return;
    clearInterval(timer);
    this.heartbeatTimers.delete(nodeId);
  }

  private notifyRuntimeSessionListeners(): void {
    for (const listener of this.runtimeSessionListeners) {
      listener();
    }
  }
}

const requireCanonicalSession = (session: AbstractBuildSession): CanonicalSession => {
  const candidate = session as Partial<CanonicalBuildSessionEventSource>;
  if (
    typeof candidate.getCanonicalStageSnapshot !== 'function' ||
    typeof candidate.takeCanonicalTaskProgressUpdates !== 'function'
  ) {
    throw new Error(
      `[CanonicalBuildSessionManager] session ${String(session.getState().nodeId)} does not implement canonical event source`
    );
  }
  return session as CanonicalSession;
};
