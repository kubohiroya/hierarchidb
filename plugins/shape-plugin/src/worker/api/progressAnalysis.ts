/**
 * Progress Analysis
 * 
 * Handles task queue progress analysis, stage status mapping, and progress payload building
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord, BuildProgressPayload } from '@hierarchidb/build-api';
import type {
    ShapeBuildProgressSummary,
} from '@hierarchidb/shape-api';
import type { BuildTask } from '~/common/types/index';
import type { StageStatus } from '@hierarchidb/shape-store';
import {
    isTaskSkipped,
} from '~/common/utils/taskMessages';
import { buildShapeTaskTitle } from '~/common/utils/taskTitles';
import {
    selectLatestTaskByProgress,
} from '../taskOrdering.js';
import { getStagePlan } from '~/services/vt/shapeProgressPlan';
import {
    toCanonicalStageId,
    isSourceStage,
    isGeometryStage,
    isTileEmitStage,
    resolveEffectiveTaskStatus,
    resolveTaskProgress,
} from './taskQueueManagement.js';
import {
    resolveQueueRecordMetadataMessage
} from './taskMetadataProcessing.js';

// Task queue analysis and progress calculation
type ProgressTaskMeta = {
    taskId: string;
    status: TaskQueueRecord['status'];
    stage: TaskQueueRecord['stage'];
    progress: number;
    title?: string;
    display?: any;
};

const resolveTaskType = (tasks: TaskQueueRecord[]): TaskQueueRecord['stage'] | undefined => {
    const stageOrder = ['source-stage', 'geometry-stage', 'tile-emit-stage'] as const;
    const matchedStageId = stageOrder.find((stageId) => (
        tasks.some((task) => {
            const status = resolveEffectiveTaskStatus(task);
            return toCanonicalStageId(task.stage) === stageId
                && status !== 'completed'
                && status !== 'failed'
                && status !== 'recycled';
        })
    ));
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
        return status === 'completed' && !isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task));
    }).length;
    const failed = nonRecycled.filter((task) => resolveEffectiveTaskStatus(task) === 'failed').length;
    const skipped = nonRecycled.filter((task) => isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))).length;
    const doneCount = Math.min(total, completed + skipped + failed);
    const hasRecycled = tasks.length > total;
    const status: BuildTask['status'] = failed > 0
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
    stage?: TaskQueueRecord['stage'],
): Promise<ShapeBuildProgressSummary> => {
    const stageCounts: Record<TaskQueueRecord['stage'], {
        total: number;
        completed: number;
        failed: number;
        skipped: number;
        recycled: number;
    }> = {
        source: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
        geometry: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
        tileEmit: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    };

    tasks.forEach((task) => {
        const bucket = stageCounts[task.stage];
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

    const completed = stageCounts.source.completed + stageCounts.geometry.completed + stageCounts.tileEmit.completed;
    const failed = stageCounts.source.failed + stageCounts.geometry.failed + stageCounts.tileEmit.failed;
    const skipped = stageCounts.source.skipped + stageCounts.geometry.skipped + stageCounts.tileEmit.skipped;
    const plan = getStagePlan(nodeId);

    const resolveStageTotal = (
        counts: typeof stageCounts[keyof typeof stageCounts],
        planned?: number,
    ): number => {
        if (typeof planned !== 'number') return counts.total;
        const adjustedPlan = Math.max(0, planned - counts.recycled);
        return Math.max(counts.total, adjustedPlan);
    };

    const total = resolveStageTotal(stageCounts.source, plan?.sourceTotal)
        + resolveStageTotal(stageCounts.geometry, plan?.geometryTotal)
        + resolveStageTotal(stageCounts.tileEmit);

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

// Stage status building and mapping
const buildStageStatus = (tasks: TaskQueueRecord[], plannedTotal?: number): StageStatus => {
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    let running = 0;
    let recycled = 0;
    let actualTotal = 0;

    tasks.forEach((task) => {
        const status = resolveEffectiveTaskStatus(task);
        if (status === 'recycled') {
            recycled += 1;
            return;
        }
        actualTotal += 1;
        if (status === 'failed') {
            failed += 1;
            return;
        }
        if (status === 'completed') {
            if (isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))) {
                skipped += 1;
            } else {
                completed += 1;
            }
            return;
        }
        if (status === 'running') {
            running += 1;
        }
    });

    const adjustedPlannedTotal = typeof plannedTotal === 'number'
        ? Math.max(0, plannedTotal - recycled)
        : undefined;
    const total = typeof adjustedPlannedTotal === 'number'
        ? Math.max(adjustedPlannedTotal, actualTotal)
        : actualTotal;
    const doneCount = Math.min(total, completed + skipped + failed);
    const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const status: StageStatus['status'] = failed > 0
        ? 'failed'
        : total > 0 && doneCount >= total
            ? 'completed'
            : running > 0
                ? 'running'
                : recycled > 0
                    ? 'completed'
                    : 'queued';

    return {
        status,
        progress,
        tasksTotal: total,
        tasksCompleted: completed + skipped,
        tasksFailed: failed,
    };
};

const buildStageStatusMap = (
    nodeId: NodeId,
    tasks: TaskQueueRecord[]
): Record<TaskQueueRecord['stage'], StageStatus> => {
    const plan = getStagePlan(nodeId);
    const sourceTasks = tasks.filter((task) => isSourceStage(task.stage));
    const geometryTasks = tasks.filter((task) => isGeometryStage(task.stage));
    const tileEmitTasks = tasks.filter((task) => isTileEmitStage(task.stage));

    return {
        source: buildStageStatus(sourceTasks, plan?.sourceTotal),
        geometry: buildStageStatus(geometryTasks, plan?.geometryTotal),
        tileEmit: buildStageStatus(tileEmitTasks),
    };
};

// Progress payload building with stage status mapping
type ShapeProgressPayload = BuildProgressPayload & {
    percentage: number;
};

export const buildProgressPayloadFromTasks = async (
    nodeId: NodeId,
    tasks: TaskQueueRecord[],
    options?: { eventTask?: TaskQueueRecord; source?: 'event' | 'snapshot' },
): Promise<ShapeProgressPayload> => {
    const summary = await summarizeTaskQueueProgress(nodeId, tasks, resolveTaskType(tasks));
    const stageStatusMap = buildStageStatusMap(nodeId, tasks);
    const progressTask = options?.eventTask ?? selectLatestTaskByProgress(tasks) ?? undefined;
    const meta: Record<string, unknown> = {};

    if (progressTask) {
        const progressTaskMeta: ProgressTaskMeta = {
            taskId: progressTask.taskId,
            status: progressTask.status,
            stage: progressTask.stage,
            progress: resolveTaskProgress(progressTask),
            title: buildShapeTaskTitle(progressTask),
            display: progressTask.display,
        };
        meta.progressTask = progressTaskMeta;
    }

    if (options?.source) {
        meta.source = options.source;
    }

    meta.stageTotals = {
        source: {
            total: stageStatusMap.source.tasksTotal,
            completed: stageStatusMap.source.tasksCompleted,
            failed: stageStatusMap.source.tasksFailed,
        },
        geometry: {
            total: stageStatusMap.geometry.tasksTotal,
            completed: stageStatusMap.geometry.tasksCompleted,
            failed: stageStatusMap.geometry.tasksFailed,
        },
        tileEmit: {
            total: stageStatusMap.tileEmit.tasksTotal,
            completed: stageStatusMap.tileEmit.tasksCompleted,
            failed: stageStatusMap.tileEmit.tasksFailed,
        },
    };

    return {
        total: summary.total,
        completed: summary.completed,
        failed: summary.failed,
        skipped: summary.skipped,
        percentage: summary.percentage,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
    };
};

// Export internal functions for use in other modules
export { summarizeTaskQueueStatus, resolveTaskType };