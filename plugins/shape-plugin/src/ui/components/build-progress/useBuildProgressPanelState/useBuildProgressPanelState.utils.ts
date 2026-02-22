import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import { resolveMostAdvancedStageId } from '~/ui/components/build-progress/stagePriority';

export const isDev = import.meta.env.DEV;

export const START_RESUME_TRACE_PREFIX = '[ShapeBuildStartResumeTrace]';
export const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';

export const logStartResumeTrace = (event: string, payload?: Record<string, unknown>): void => {
  console.log(`${START_RESUME_TRACE_PREFIX} ${event}`, payload ?? {});
};

export const formatRunningResidueValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized.replace(/\s+/g, '_') : '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export const logRunningResiduePanel = (
  keyword: 'UI_MISMATCH' | 'UI_MISMATCH_RESOLVED',
  payload: {
    nodeId: string | null;
    stage: string;
    buildStatus: BuildStatus;
    activeStageId: string | null;
    indicatorIsRunning: boolean;
    runningCount: number;
    runningTaskIds: string[];
    reasons: string[];
  },
): void => {
  if (!isDev) return;
  const line = `${RUNNING_RESIDUE_LOG_PREFIX} ${keyword}`
    + ` nodeId=${formatRunningResidueValue(payload.nodeId)}`
    + ` stage=${formatRunningResidueValue(payload.stage)}`
    + ` taskId=${formatRunningResidueValue(payload.runningTaskIds.join(','))}`
    + ` sequence=- prevStatus=- nextStatus=-`
    + ` source=ui`
    + ` eventType=aggregate`
    + ` reason=${formatRunningResidueValue(payload.reasons.join(','))}`
    + ` runningCount=${formatRunningResidueValue(payload.runningCount)}`
    + ` queuedCount=- totalCount=-`
    + ` stageIsRunning=${formatRunningResidueValue(payload.indicatorIsRunning)}`
    + ` buildStatus=${formatRunningResidueValue(payload.buildStatus)}`
    + ` activeStageId=${formatRunningResidueValue(payload.activeStageId)}`
    + ` timestamp=${formatRunningResidueValue(Date.now())}`;
  console.log(line, payload);
};

export const shouldUpdateElapsedSnapshot = (params: {
  snapshot: { elapsedMs: number; capturedAt: number } | null;
  totalElapsedMs: number;
  buildStatus: BuildStatus;
}): boolean => {
  const { snapshot, totalElapsedMs, buildStatus } = params;
  if (!snapshot) return true;
  if (buildStatus !== 'running' && totalElapsedMs === 0) return false;
  if (totalElapsedMs === 0) return true;
  return totalElapsedMs > snapshot.elapsedMs;
};

export const resolveCompletionFailedStageLabel = (params: {
  stages: BuildStage[];
  failedStageId?: string;
  fallbackStageLabel: string;
}): string => {
  if (!params.failedStageId) return params.fallbackStageLabel;
  const failedStage = params.stages.find((stage) => stage.id === params.failedStageId);
  return failedStage?.title ?? params.failedStageId;
};

export const resolveActiveRunningStageId = (params: {
  stages: BuildStage[];
  stageTaskScan: Record<string, { hasRunning: boolean }>;
}): string | null => {
  const runningStageIds = params.stages
    .filter((stage) => params.stageTaskScan[stage.id]?.hasRunning)
    .map((stage) => stage.id);
  return resolveMostAdvancedStageId(runningStageIds, params.stages);
};
