import type { NodeId } from '@hierarchidb/core-types';
import {
  LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING,
  ShapeBuildSessionContractError,
  isShapeBuildSessionContractError,
  type ShapeBuildSessionProbeResult,
} from '@hierarchidb/shape-api';
import type {
  BuildSessionHeartbeat,
  BuildSessionRecord,
  BuildSessionStatus,
  BuildStage,
  BuildStageStatus,
  EphemeralBuildSessionRecord,
  EphemeralBuildTaskRecord,
  EphemeralStageStatus,
} from './EphemeralDBRecordTypes';

/**
 * ProgressInfo represents the overall progress of a build session
 */
export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
}

export type BuildSessionDetailsQuery = {
  getConfig: (nodeId: NodeId) => Promise<BuildSessionRecord | undefined>;
  getHeartbeat: (nodeId: NodeId) => Promise<BuildSessionHeartbeat | undefined>;
  getStatus: (nodeId: NodeId) => Promise<BuildSessionStatus | undefined>;
  getStageStatuses: (nodeId: NodeId) => Promise<BuildStageStatus[]>;
  getTasks: (nodeId: NodeId) => Promise<EphemeralBuildTaskRecord[]>;
};

const requireFiniteNonNegativeTime = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `[getSessionWithDetails] ${label} must be a finite non-negative number, received ${String(value)}`
    );
  }
  return value;
};

const requireStageInactiveMs = (
  nodeId: NodeId,
  stageStatus: BuildStageStatus,
  index: number
): number => {
  if (stageStatus.inactiveMs === undefined) {
    const message = `[getSessionWithDetails] stageStatuses[${index}].inactiveMs must be a finite non-negative number, received undefined`;
    throw new ShapeBuildSessionContractError({
      code: LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING,
      recoverable: true,
      nodeId,
      table: 'buildStageStatuses',
      field: 'inactiveMs',
      fieldPath: 'buildStageStatuses.inactiveMs',
      stageStatusId: stageStatus.id,
      stage: stageStatus.stage,
      received: 'undefined',
      message,
    });
  }
  return requireFiniteNonNegativeTime(stageStatus.inactiveMs, `stageStatuses[${index}].inactiveMs`);
};

const validateCompletedInterval = (params: {
  startedAt: number;
  completedAt: number | undefined;
  inactiveMs: number | undefined;
  label: string;
}): void => {
  const inactiveMs =
    params.inactiveMs === undefined
      ? 0
      : requireFiniteNonNegativeTime(params.inactiveMs, `${params.label}.inactiveMs`);
  if (params.completedAt === undefined) return;
  const completedAt = requireFiniteNonNegativeTime(
    params.completedAt,
    `${params.label}.completedAt`
  );
  if (completedAt - params.startedAt - inactiveMs < 0) {
    throw new Error(
      `[getSessionWithDetails] ${params.label} completed interval must be non-negative`
    );
  }
};

const resolveSessionUpdatedAt = (params: {
  config: BuildSessionRecord;
  heartbeat: BuildSessionHeartbeat | undefined;
  status: BuildSessionStatus;
  stageStatuses: BuildStageStatus[];
  tasks: EphemeralBuildTaskRecord[];
}): number => {
  const startedAt = requireFiniteNonNegativeTime(params.config.startedAt, 'config.startedAt');
  if (
    (params.status.status === 'completed' || params.status.status === 'failed') &&
    params.status.completedAt === undefined
  ) {
    throw new Error(
      `[getSessionWithDetails] status.completedAt is required for terminal status ${params.status.status}`
    );
  }
  validateCompletedInterval({
    startedAt,
    completedAt: params.status.completedAt,
    inactiveMs: params.status.inactiveMs,
    label: 'status',
  });
  const timestamps = [startedAt];
  const appendOptional = (value: unknown, label: string): void => {
    if (value !== undefined) {
      timestamps.push(requireFiniteNonNegativeTime(value, label));
    }
  };
  appendOptional(params.heartbeat?.lastHeartbeatAt, 'heartbeat.lastHeartbeatAt');
  appendOptional(params.status.completedAt, 'status.completedAt');
  params.stageStatuses.forEach((stageStatus, index) => {
    const stageStartedAt = requireFiniteNonNegativeTime(
      stageStatus.startedAt,
      `stageStatuses[${index}].startedAt`
    );
    const stageInactiveMs = requireStageInactiveMs(params.config.nodeId, stageStatus, index);
    validateCompletedInterval({
      startedAt: stageStartedAt,
      completedAt: stageStatus.completedAt,
      inactiveMs: stageInactiveMs,
      label: `stageStatuses[${index}]`,
    });
    timestamps.push(stageStartedAt);
    appendOptional(stageStatus.completedAt, `stageStatuses[${index}].completedAt`);
  });
  params.tasks.forEach((task, index) => {
    appendOptional(task.createdAt, `tasks[${index}].createdAt`);
    appendOptional(task.updatedAt, `tasks[${index}].updatedAt`);
    appendOptional(task.startedAt, `tasks[${index}].startedAt`);
    appendOptional(task.completedAt, `tasks[${index}].completedAt`);
  });
  return Math.max(...timestamps);
};

/**
 * Compute progress information from an array of build tasks
 * 
 * @param tasks - Array of build task records
 * @returns ProgressInfo with total, completed, failed, skipped counts and percentage
 */
export function computeProgressFromTasks(tasks: EphemeralBuildTaskRecord[]): ProgressInfo {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const skipped = 0; // Computed from task metadata if needed in the future
  
  return {
    total,
    completed,
    failed,
    skipped,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  };
}

/**
 * Compute per-stage status information from an array of build tasks
 * 
 * @param tasks - Array of build task records
 * @returns Record mapping each BuildStage to its EphemeralStageStatus
 */
export function computeStagesFromTasks(
  tasks: EphemeralBuildTaskRecord[]
): Record<BuildStage, EphemeralStageStatus> {
  const stages: Record<BuildStage, EphemeralStageStatus> = {
    source: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    geometry: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    tileEmit: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
  };
  
  // Aggregate tasks by stage
  for (const task of tasks) {
    const stage = stages[task.stage];
    stage.tasksTotal++;
    
    if (task.status === 'completed') {
      stage.tasksCompleted++;
    }
    if (task.status === 'failed') {
      stage.tasksFailed++;
    }
    if (task.status === 'running') {
      stage.status = 'running';
    }
  }
  
  // Calculate progress percentage and determine final status for each stage
  for (const stage of Object.values(stages)) {
    // Calculate progress percentage
    stage.progress = stage.tasksTotal > 0 ? (stage.tasksCompleted / stage.tasksTotal) * 100 : 0;
    
    // Determine stage status based on task statuses
    if (stage.tasksFailed > 0) {
      stage.status = 'failed';
    } else if (stage.tasksCompleted === stage.tasksTotal && stage.tasksTotal > 0) {
      stage.status = 'completed';
    } else if (stage.status !== 'running' && stage.tasksTotal > 0) {
      // If we have tasks but none are running, they must be queued
      stage.status = 'queued';
    }
  }
  
  return stages;
}

/**
 * Unified query interface for session data
 * 
 * Queries all four normalized tables (buildSessionConfigs, buildSessionHeartbeats,
 * buildSessionStatuses, buildStageStatuses) and buildTasks, then reconstructs
 * the unified EphemeralBuildSessionRecord structure.
 * 
 * @param nodeId - The node ID to query session data for
 * @param queryFn - Function that queries the database tables
 * @returns Unified session record or null if session not found
 */
export async function getSessionWithDetails(
  nodeId: NodeId,
  queryFn: BuildSessionDetailsQuery
): Promise<EphemeralBuildSessionRecord | null> {
  // Query all tables in parallel
  const [config, heartbeat, status, stageStatuses, tasks] = await Promise.all([
    queryFn.getConfig(nodeId),
    queryFn.getHeartbeat(nodeId),
    queryFn.getStatus(nodeId),
    queryFn.getStageStatuses(nodeId),
    queryFn.getTasks(nodeId),
  ]);

  if (!config && !status) {
    if (heartbeat || stageStatuses.length > 0) {
      throw new Error(`[getSessionWithDetails] normalized session has orphan rows: ${String(nodeId)}`);
    }
    return null;
  }
  if (!config || !status) {
    throw new Error(`[getSessionWithDetails] normalized session is incomplete: ${String(nodeId)}`);
  }

  // Compute progress from tasks
  const progress = computeProgressFromTasks(tasks);

  // Compute stages from tasks
  const stages = computeStagesFromTasks(tasks);

  const updatedAt = resolveSessionUpdatedAt({ config, heartbeat, status, stageStatuses, tasks });
  const latestStageStartedAt = stageStatuses.reduce(
    (latest, current) => Math.max(latest, current.startedAt),
    Number.NEGATIVE_INFINITY
  );
  const latestStages = stageStatuses.filter((stage) => stage.startedAt === latestStageStartedAt);
  if (latestStages.length > 1) {
    throw new Error(
      `[getSessionWithDetails] normalized session has ambiguous current stage: ${String(nodeId)}`
    );
  }
  const currentStage = latestStages[0];

  // Reconstruct unified record matching old EphemeralBuildSessionRecord structure
  return {
    nodeId: config.nodeId,
    domainType: config.domainType,
    status: status.status,
    stopReason: status.stopReason,
    stage: currentStage?.stage,
    progress,
    stages,
    selectedArrayByCountries: config.selectedArrayByCountries,
    selectedArrayVersion: config.selectedArrayVersion,
    startedAt: config.startedAt,
    updatedAt,
    completedAt: status.completedAt,
    inactiveMs: status.inactiveMs,
    canResume: status.canResume,
    lastHeartbeatAt: heartbeat?.lastHeartbeatAt,
    stageStartedAt: currentStage?.startedAt,
    stageInactiveMs:
      currentStage === undefined
        ? undefined
        : requireFiniteNonNegativeTime(currentStage.inactiveMs, 'currentStage.inactiveMs'),
    stageId: currentStage?.stage,
    sourceStageMaxima: config.sourceStageMaxima,
  };
}

export async function probeBuildSession(
  nodeId: NodeId,
  queryFn: BuildSessionDetailsQuery
): Promise<ShapeBuildSessionProbeResult> {
  try {
    const session = await getSessionWithDetails(nodeId, queryFn);
    return session === null ? { kind: 'missing' } : { kind: 'available' };
  } catch (error) {
    if (isShapeBuildSessionContractError(error)) {
      return {
        kind: 'recoverable-contract-error',
        error: error.details,
      };
    }
    throw error;
  }
}
