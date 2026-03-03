import type { NodeId } from '@hierarchidb/core-types';
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
 * Queries all four normalized tables (buildSessions, buildSessionHeartbeats,
 * buildSessionStatuses, buildStageStatuses) and buildTasks, then reconstructs
 * the unified EphemeralBuildSessionRecord structure.
 * 
 * @param nodeId - The node ID to query session data for
 * @param queryFn - Function that queries the database tables
 * @returns Unified session record or null if session not found
 */
export async function getSessionWithDetails(
  nodeId: NodeId,
  queryFn: {
    getConfig: (nodeId: NodeId) => Promise<BuildSessionRecord | undefined>;
    getHeartbeat: (nodeId: NodeId) => Promise<BuildSessionHeartbeat | undefined>;
    getStatus: (nodeId: NodeId) => Promise<BuildSessionStatus | undefined>;
    getStageStatuses: (nodeId: NodeId) => Promise<BuildStageStatus[]>;
    getTasks: (nodeId: NodeId) => Promise<EphemeralBuildTaskRecord[]>;
  }
): Promise<EphemeralBuildSessionRecord | null> {
  // Query all tables in parallel
  const [config, heartbeat, status, stageStatuses, tasks] = await Promise.all([
    queryFn.getConfig(nodeId),
    queryFn.getHeartbeat(nodeId),
    queryFn.getStatus(nodeId),
    queryFn.getStageStatuses(nodeId),
    queryFn.getTasks(nodeId),
  ]);

  // Session must have at least config and status
  if (!config || !status) {
    return null;
  }

  // Compute progress from tasks
  const progress = computeProgressFromTasks(tasks);

  // Compute stages from tasks
  const stages = computeStagesFromTasks(tasks);

  // Get current stage (latest by startedAt from buildStageStatuses)
  const currentStage = stageStatuses.length > 0
    ? stageStatuses.reduce((latest, current) =>
        current.startedAt > latest.startedAt ? current : latest
      )
    : undefined;

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
    completedAt: status.completedAt,
    lastHeartbeatAt: heartbeat?.lastHeartbeatAt,
    stageStartedAt: currentStage?.startedAt,
    stageInactiveMs: currentStage?.inactiveMs,
    stageId: currentStage?.stageId,
    sourceStageMaxima: config.sourceStageMaxima,
  };
}
