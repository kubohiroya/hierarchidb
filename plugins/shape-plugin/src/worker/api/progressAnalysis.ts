/**
 * Progress Analysis
 *
 * Handles task queue status and summary analysis.
 */

import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildProgressSummary, ShapeBuildStage } from '@hierarchidb/shape-api';
import type { BuildTask } from '~/common/types/BuildTaskResult';
import { isTaskSkipped } from '~/common/utils/taskMessageUtils';
import { getStagePlan } from '~/services/vt/shapeProgressPlanUtils';
import { resolveQueueRecordMetadataMessage } from './taskMetadataProcessingConstants.js';
import {
  requireShapeTaskStage,
  resolveEffectiveTaskStatus,
  toCanonicalStageId,
} from './taskQueueManagement.js';

// Task queue analysis and progress calculation
const resolveTaskType = (tasks: TaskQueueRecord[]): ShapeBuildStage | undefined => {
  const stageOrder = ['source-stage', 'geometry-stage', 'tile-emit-stage'] as const;
  const matchedStageId = stageOrder.find((stageId) =>
    tasks.some((task) => {
      const status = resolveEffectiveTaskStatus(task);
      return (
        toCanonicalStageId(task.stage) === stageId &&
        status !== 'completed' &&
        status !== 'failed' &&
        status !== 'recycled'
      );
    })
  );
  if (matchedStageId === 'source-stage') return 'source';
  if (matchedStageId === 'geometry-stage') return 'geometry';
  if (matchedStageId === 'tile-emit-stage') return 'tileEmit';
  return undefined;
};

const summarizeTaskQueueStatus = (tasks: TaskQueueRecord[]) => {
  const nonRecycled = tasks.filter((task) => resolveEffectiveTaskStatus(task) !== 'recycled');
  const total = nonRecycled.length;
  const completed = nonRecycled.filter((task) => {
    const status = resolveEffectiveTaskStatus(task);
    return (
      status === 'completed' &&
      !isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))
    );
  }).length;
  const failed = nonRecycled.filter((task) => resolveEffectiveTaskStatus(task) === 'failed').length;
  const skipped = nonRecycled.filter((task) =>
    isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))
  ).length;
  const doneCount = Math.min(total, completed + skipped + failed);
  const hasRecycled = tasks.length > total;
  const status: BuildTask['status'] =
    failed > 0
      ? 'failed'
      : total > 0 && doneCount >= total
        ? 'completed'
        : total > 0
          ? 'running'
          : hasRecycled
            ? 'completed'
            : 'idle';
  return {
    status,
    stage: resolveTaskType(tasks),
  };
};

const summarizeTaskQueueProgress = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  stage?: ShapeBuildStage
): Promise<ShapeBuildProgressSummary> => {
  const stageCounts: Record<
    ShapeBuildStage,
    {
      total: number;
      completed: number;
      failed: number;
      skipped: number;
      recycled: number;
    }
  > = {
    source: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    geometry: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    tileEmit: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
  };

  tasks.forEach((task) => {
    const bucket = stageCounts[requireShapeTaskStage(task.stage)];
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      bucket.recycled += 1;
      return;
    }
    bucket.total += 1;
    if (isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))) {
      bucket.skipped += 1;
      return;
    }
    if (status === 'failed') {
      bucket.failed += 1;
      return;
    }
    if (status === 'completed') {
      bucket.completed += 1;
    }
  });

  const completed =
    stageCounts.source.completed + stageCounts.geometry.completed + stageCounts.tileEmit.completed;
  const failed =
    stageCounts.source.failed + stageCounts.geometry.failed + stageCounts.tileEmit.failed;
  const skipped =
    stageCounts.source.skipped + stageCounts.geometry.skipped + stageCounts.tileEmit.skipped;
  const plan = getStagePlan(nodeId);

  const resolveStageTotal = (
    counts: (typeof stageCounts)[keyof typeof stageCounts],
    planned?: number
  ): number => {
    if (typeof planned !== 'number') return counts.total;
    const adjustedPlan = Math.max(0, planned - counts.recycled);
    return Math.max(counts.total, adjustedPlan);
  };

  const total =
    resolveStageTotal(stageCounts.source, plan?.sourceTotal) +
    resolveStageTotal(stageCounts.geometry, plan?.geometryTotal) +
    resolveStageTotal(stageCounts.tileEmit);

  let resolvedStage = stage;
  if (!resolvedStage && tasks.length === 0 && plan?.sourceTotal && plan.sourceTotal > 0) {
    resolvedStage = 'source';
  }
  if (!resolvedStage && tasks.length === 0 && plan?.geometryTotal && plan.geometryTotal > 0) {
    resolvedStage = 'geometry';
  }

  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    stage: resolvedStage,
  };
};

export const buildTaskQueueSummary = async (nodeId: NodeId, tasks: TaskQueueRecord[]) => {
  const statusSummary = summarizeTaskQueueStatus(tasks);
  const progress = await summarizeTaskQueueProgress(nodeId, tasks, statusSummary.stage);
  return {
    status: statusSummary.status,
    progress,
  };
};

// Export internal functions for use in other modules
export { summarizeTaskQueueStatus, resolveTaskType };
