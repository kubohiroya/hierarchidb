import type {
  BuildSessionState,
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
} from '@hierarchidb/build-api';

export const createSessionStatusUpdatedPayload = (
  state: BuildSessionState,
  stageSnapshot: StageSnapshotUpdatedEvent['payload'] | null
): SessionStatusUpdatedEvent['payload'] => {
  const phase = toSessionPhase(state.status);
  return {
    nodeId: state.nodeId,
    phase,
    isActive: isActiveSessionPhase(phase),
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    stopReason: resolveStopReason(phase),
    stageId: stageSnapshot?.stageId,
    stageStartedAt: stageSnapshot?.stageStartedAt,
    stageInactiveMs: stageSnapshot?.stageInactiveMs,
  };
};

const toSessionPhase = (status: BuildSessionState['status']): SessionPhase => {
  switch (status) {
    case 'idle':
      return 'idle';
    case 'queued':
      return 'starting';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'recycled':
      return 'finalizing';
    default: {
      const exhaustiveStatus: never = status;
      throw new Error(
        `[canonicalSessionEvents] unsupported build status: ${String(exhaustiveStatus)}`
      );
    }
  }
};

const isActiveSessionPhase = (phase: SessionPhase): boolean =>
  phase === 'starting' ||
  phase === 'running' ||
  phase === 'pausing' ||
  phase === 'resuming' ||
  phase === 'finalizing';

const resolveStopReason = (
  phase: SessionPhase
): SessionStatusUpdatedEvent['payload']['stopReason'] => {
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return undefined;
};
