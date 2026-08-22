/**
 * Task Summary Mapping
 *
 * Handles mapping between TaskQueueRecord and BuildTaskSummary
 */

import type { BuildTaskSummary, TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  buildPreviewMetadataFromTask,
  buildTaskSummaryFields,
  sanitizeTaskMetadataForSummary,
} from './taskMetadataProcessingConstants.js';
import {
  resolveEffectiveTaskStatus,
  resolveTaskProgress,
  toCanonicalStageId,
} from './taskQueueManagement.js';

export type ShapeBuildTaskSummary = BuildTaskSummary & {
  nodeId?: NodeId;
  title?: string;
  message?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
};

export const mapTaskQueueRecordToTaskSummary = (task: TaskQueueRecord): ShapeBuildTaskSummary => {
  const base = buildTaskSummaryFields(task);
  const preview = buildPreviewMetadataFromTask(task);
  const metadata = sanitizeTaskMetadataForSummary(task, preview);
  return {
    taskId: task.taskId,
    version: task.version,
    nodeId: task.nodeId,
    stage: task.stage,
    stageId: toCanonicalStageId(task.stage),
    status: resolveEffectiveTaskStatus(task),
    progress: resolveTaskProgress(task),
    display: task.display,
    message: task.message,
    title: base.title,
    error: base.error,
    errorMessage: base.errorMessage,
    index: base.index,
    stagePriority: base.stagePriority,
    metadata,
  };
};
