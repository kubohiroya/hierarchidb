/**
 * Session Configuration
 * 
 * Handles build session configuration resolution and mapping
 */

import type { NodeId } from '@hierarchidb/core-types';
import type {
    ShapeRuntimeBuildConfig,
} from '~/common/types/index';
import {
    type BuildSession,
    DEFAULT_BUILD_CONFIG,
    DEFAULT_PROCESSING_CONFIG,
    composeRuntimeBuildConfig,
    applyBuildConfigPatch,
    mergeProcessingConfig,
    requireDataSourceName,
} from '~/common/types/index';
import { ShapeEntityHandler } from '../handlers/index.js';
import { Dexie } from 'dexie';
import {
    VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import type { BuildSessionConfig, BuildSessionRecord } from '@hierarchidb/shape-store';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
    type TaskQueueStatusCounts,
    countTaskQueueStatuses,
} from './taskQueueManagement.js';
import { toBuildSessionRecord } from '~/services/build/shapeSessionMappers';

// Singleton entity handler
const shapeEntityHandlerSingleton = new ShapeEntityHandler();
export const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

// Build session configuration and mapping
const mapBuildSessionRecordToBuildSession = (
    record: BuildSessionRecord,
    config: BuildSessionConfig,
): BuildSession => ({
    nodeId: record.nodeId,
    status: record.status,
    config,
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    progress: record.progress,
    canResume: record.canResume,
    lastActivity: record.lastActivity ?? record.updatedAt,
    expiresAt: record.expiresAt,
    stages: record.stages,
    resourceUsage: record.resourceUsage,
});

const resolveBuildSessionConfig = async (nodeId: NodeId): Promise<BuildSessionConfig> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(nodeId);
    const mergedBuildConfig = applyBuildConfigPatch(
        DEFAULT_BUILD_CONFIG,
        entity?.buildConfig ?? {},
    );
    const mergedProcessingConfig = mergeProcessingConfig(
        DEFAULT_PROCESSING_CONFIG,
        entity?.processingConfig ?? {},
    );
    return buildBuildSessionConfig(composeRuntimeBuildConfig(mergedBuildConfig, mergedProcessingConfig));
};

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
    const resolvedDataSource = requireDataSourceName(
        buildConfig.dataSourceName,
        'buildBuildSessionConfig',
    );
    return {
        dataSource: resolvedDataSource,
        sourceConfig: buildConfig.sourceConfig,
        geometryConfig: buildConfig.geometryConfig,
        vectorTiles: buildConfig.tileEmitConfig,
    };
};

const resolveBuildSessionStatusFromCounts = (
    nodeId: NodeId,
    counts: TaskQueueStatusCounts,
    getPauseState: (nodeId: NodeId) => { paused: boolean },
): BuildSession['status'] => {
    const effectiveTotal = Math.max(0, counts.total - counts.recycled);
    if (getPauseState(nodeId).paused) return 'paused';
    if (counts.running > 0) return 'running';
    if (counts.failed > 0) return 'failed';
    if (effectiveTotal > 0 && counts.completed + counts.failed >= effectiveTotal) return 'completed';
    if (effectiveTotal > 0) return 'queued';
    if (counts.recycled > 0) return 'completed';
    return 'idle';
};

const buildProgressFromCounts = (counts: TaskQueueStatusCounts): BuildSession['progress'] => {
    const effectiveTotal = Math.max(0, counts.total - counts.recycled);
    const doneCount = Math.min(effectiveTotal, counts.completed + counts.failed);
    return {
        total: effectiveTotal,
        completed: counts.completed,
        failed: counts.failed,
        skipped: 0,
        percentage: effectiveTotal > 0 ? Math.round((doneCount / effectiveTotal) * 100) : 0,
    };
};

export const resolveSessionExpiresAt = (lastActivity: number): number => (
    lastActivity + 5 * 60 * 1000
);

export const getBuildSessionInternal = async (
    nodeId: NodeId,
): Promise<BuildSession | undefined> => {
    // Import getPauseState dynamically to avoid circular dependency
    const { getPauseState } = await import('./stateManagement.js');

    const config = await resolveBuildSessionConfig(nodeId);
    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
    const buildSession = sessionRecord ? toBuildSessionRecord(sessionRecord) : null;
    if (buildSession) {
        return mapBuildSessionRecordToBuildSession(buildSession, config);
    }

    const taskQueue = new VtTaskQueueDb();
    const counts = await countTaskQueueStatuses(taskQueue, nodeId);
    if (counts.total === 0) return undefined;

    const firstTask = await taskQueue.tasks
        .where('[nodeId+index]')
        .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
        .first();
    const now = Date.now();
    const status = resolveBuildSessionStatusFromCounts(nodeId, counts, getPauseState);
    const progress = buildProgressFromCounts(counts);
    const startedAt = typeof firstTask?.createdAt === 'number' ? firstTask.createdAt : now;

    return {
        nodeId,
        status,
        config,
        startedAt,
        updatedAt: now,
        completedAt: status === 'completed' ? now : undefined,
        progress,
        canResume: status === 'paused',
        lastActivity: now,
        expiresAt: resolveSessionExpiresAt(now),
        stages: {},
        resourceUsage: undefined,
    };
};