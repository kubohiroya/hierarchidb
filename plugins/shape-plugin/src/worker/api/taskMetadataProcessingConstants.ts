/**
 * Task Metadata Processing
 * 
 * Handles task metadata extraction, sanitization, and preview generation
 */

import type { TaskQueueRecord } from '@hierarchidb/build-api';
import { buildShapeTaskTitle } from '~/common/utils/taskTitleUtils';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
import { isSourceStage, isGeometryStage, isTileEmitStage } from './taskQueueManagement.js';

export const buildTaskSummaryFields = (
    task: TaskQueueRecord,
): {
    title?: string;
    error?: string;
    errorMessage?: string;
    index?: number;
    stagePriority?: number;
    metadata?: Record<string, unknown>;
} => ({
    title: buildShapeTaskTitle(task),
    error: task.errorMessage,
    errorMessage: task.errorMessage,
    index: task.index,
    stagePriority: task.stagePriority,
    metadata: task.metadata,
});

const asRecord = (value: unknown): Record<string, unknown> | null => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const readString = (value: unknown): string | null => (
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const readNumber = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

const pickPrimitiveMetadataField = (metadata: Record<string, unknown>, key: string): unknown => {
    const value = metadata[key];
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return undefined;
};

const pickRecordMetadataField = (metadata: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
    const value = asRecord(metadata[key]);
    if (!value) return undefined;
    return value;
};

const buildFetchDetailFromGeometryInput = (task: TaskQueueRecord): Record<string, unknown> | null => {
    if (!isGeometryStage(task.stage)) return null;
    const input = asRecord(task.inputData);
    if (!input) return null;
    const sourceFeatureInput = readNumber(input.sourceFeatureInputCount);
    const sourceFeatureOutput = readNumber(input.sourceFeatureOutputCount);
    const sourcePolygonInput = readNumber(input.sourcePolygonInputCount);
    const sourcePolygonOutput = readNumber(input.sourcePolygonOutputCount);
    const hasMetrics = (
        sourceFeatureInput !== null
        || sourceFeatureOutput !== null
        || sourcePolygonInput !== null
        || sourcePolygonOutput !== null
    );
    if (!hasMetrics) return null;
    return {
        countryCode: readString(input.sourceCountryCode) ?? readString(input.countryCode),
        countryName: readString(input.countryName),
        adminLevel: readNumber(input.adminLevel),
        url: readString(input.sourceUrl),
        features: {
            input: sourceFeatureInput,
            output: sourceFeatureOutput,
        },
        polygons: {
            input: sourcePolygonInput,
            output: sourcePolygonOutput,
        },
    };
};

export const sanitizeTaskMetadataForSummary = (
    task: TaskQueueRecord,
    preview: Record<string, unknown> | null,
): Record<string, unknown> | undefined => {
    const metadata = asRecord(task.metadata);
    const next: Record<string, unknown> = {};

    if (preview) {
        next.preview = preview;
    }

    if (!metadata) {
        return Object.keys(next).length > 0 ? next : undefined;
    }

    const primitiveKeys = [
        'message',
        'adminLevel',
        'retryAttempt',
        'retryAttemptsTotal',
        'finalRetryAttempts',
        'retryMax',
        'finalRetryCount',
        'finalRetryLimit',
        'retryCount',
        'retryLimit',
        'maxRetryAttempts',
        'toleranceSearchIterations',
        'effectiveTolerance',
        'effective_tolerance',
        'finalTolerance',
        'finalEffectiveTolerance',
        'extractionRatio',
        'retryVertexLimit',
        'vertexLimit',
        'maxVerticesPerFeature',
        'cacheReuse',
        'authState',
    ] as const;

    for (const key of primitiveKeys) {
        const value = pickPrimitiveMetadataField(metadata, key);
        if (value !== undefined) {
            next[key] = value;
        }
    }

    const fetchDetail = pickRecordMetadataField(metadata, 'fetchDetail');
    if (fetchDetail) {
        next.fetchDetail = fetchDetail;
    } else {
        const fetchDetailFromInput = buildFetchDetailFromGeometryInput(task);
        if (fetchDetailFromInput) {
            next.fetchDetail = fetchDetailFromInput;
        }
    }

    // Promote metadata.error.message to errorMessage so UI summary builders
    // can surface the actual failure reason instead of falling back to taskTitle.
    const errorRecord = pickRecordMetadataField(metadata, 'error');
    if (errorRecord) {
        const errorMsg = readString(errorRecord.message);
        if (errorMsg) {
            next.errorMessage = errorMsg;
        }
    }

    const tileEmitParentInputSummary = pickRecordMetadataField(metadata, 'tileEmitParentInputSummary');
    if (tileEmitParentInputSummary) {
        next.tileEmitParentInputSummary = tileEmitParentInputSummary;
    }

    const nestedMetadata = pickRecordMetadataField(metadata, 'metadata');
    if (nestedMetadata) {
        const compactNested: Record<string, unknown> = {};
        for (const key of [
            'adminLevel',
            'retryAttempt',
            'retryAttemptsTotal',
            'retryMax',
            'finalRetryCount',
            'finalRetryLimit',
            'finalRetryAttempts',
            'effectiveTolerance',
            'finalTolerance',
            'extractionRatio',
            'retryCount',
            'retryLimit',
            'maxRetryAttempts',
            'toleranceSearchIterations',
            'retryVertexLimit',
            'vertexLimit',
            'maxVerticesPerFeature',
        ]) {
            const value = pickPrimitiveMetadataField(nestedMetadata, key);
            if (value !== undefined) {
                compactNested[key] = value;
            }
        }
        if (Object.keys(compactNested).length > 0) {
            next.metadata = compactNested;
        }
    }

    if (isTileEmitStage(task.stage) && !next.tileEmitParentInputSummary) {
        // TileEmit tasks are high-cardinality; avoid carrying non-essential metadata per task.
        return Object.keys(next).length > 0 ? next : undefined;
    }

    return Object.keys(next).length > 0 ? next : undefined;
};

export const buildPreviewMetadataFromTask = (task: TaskQueueRecord): Record<string, unknown> | null => {
    const metadata = asRecord(task.metadata);
    const preview = asRecord(metadata?.preview);
    const input = asRecord(task.inputData);
    const output = asRecord(task.outputData);

    if (isSourceStage(task.stage)) {
        const sourceKey = readString(preview?.sourceKey) ?? readString(input?.sourceKey);
        const rawSourceCacheKey = readString(preview?.rawSourceCacheKey);
        const sourceCacheId = readString(preview?.sourceCacheId)
            ?? readString(output?.sourceCacheId)
            ?? (sourceKey ? `${String(task.nodeId)}-shape-${sourceKey}` : null);
        const dataSource = readString(preview?.dataSource) ?? readString(input?.dataSource);
        const sourceUrl = readString(preview?.sourceUrl) ?? readString(input?.url);
        const sourceCountryCode = readString(preview?.sourceCountryCode)
            ?? readString(input?.urlCountryCode)
            ?? readString(input?.countryCode);
        const adminLevel = readNumber(preview?.adminLevel) ?? readNumber(input?.adminLevel);

        if (!sourceCacheId && !sourceKey && !sourceUrl) return preview;
        return {
            stage: 'source',
            sourceKey: sourceKey ?? null,
            dataSource: dataSource ?? null,
            sourceUrl: sourceUrl ?? null,
            sourceCountryCode: sourceCountryCode ?? null,
            adminLevel: adminLevel ?? null,
            rawSourceCacheKey: rawSourceCacheKey ?? null,
            sourceCacheId: sourceCacheId ?? null,
            sourceCacheFormat: readString(preview?.sourceCacheFormat) ?? 'flatgeobuf',
            sourceCacheCompression: readString(preview?.sourceCacheCompression) ?? 'none',
        };
    }

    if (isGeometryStage(task.stage)) {
        const sourceKey = readString(preview?.sourceKey) ?? readString(input?.sourceKey);
        const rawSourceCacheKey = readString(preview?.rawSourceCacheKey);
        const bandIndex = readNumber(preview?.bandIndex) ?? readNumber(input?.bandIndex);
        const bandMinZoom = readNumber(preview?.bandMinZoom)
            ?? readNumber(preview?.zMin)
            ?? readNumber(input?.bandMinZoom)
            ?? readNumber(input?.zMin)
            ?? readNumber(input?.zoomMin);
        const bandMaxZoom = readNumber(preview?.bandMaxZoom)
            ?? readNumber(preview?.zMax)
            ?? readNumber(input?.bandMaxZoom)
            ?? readNumber(input?.zMax)
            ?? readNumber(input?.zoomMax);
        const domainType = readString(input?.domainType) ?? 'shape';
        const sourceCacheId = readString(preview?.sourceCacheId) ?? readString(input?.sourceCacheId);
        const geometryCacheId = readString(preview?.geometryCacheId)
            ?? readString(output?.geometryCacheId)
            ?? (sourceKey && bandIndex !== null
                ? `${String(task.nodeId)}-b${Math.floor(bandIndex)}-${domainType}-${sourceKey}`
                : null);
        const sourceCountryCode = readString(preview?.sourceCountryCode)
            ?? readString(input?.sourceCountryCode)
            ?? readString(input?.countryCode);
        const adminLevel = readNumber(preview?.adminLevel) ?? readNumber(input?.adminLevel);

        if (!sourceCacheId && !geometryCacheId && !sourceKey) return preview;
        return {
            stage: 'geometry',
            sourceKey: sourceKey ?? null,
            bandIndex: bandIndex ?? null,
            dataSource: readString(preview?.dataSource) ?? readString(input?.dataSource) ?? null,
            sourceUrl: readString(preview?.sourceUrl) ?? readString(input?.sourceUrl) ?? null,
            sourceCountryCode: sourceCountryCode ?? null,
            adminLevel: adminLevel ?? null,
            bandMinZoom: bandMinZoom ?? null,
            bandMaxZoom: bandMaxZoom ?? null,
            rawSourceCacheKey: rawSourceCacheKey ?? null,
            sourceCacheId: sourceCacheId ?? null,
            sourceCacheFormat: readString(preview?.sourceCacheFormat) ?? readString(input?.sourceCacheFormat) ?? 'flatgeobuf',
            sourceCacheCompression: readString(preview?.sourceCacheCompression) ?? readString(input?.sourceCacheCompression) ?? 'none',
            geometryCacheId: geometryCacheId ?? null,
        };
    }

    return preview;
};

export const resolveTaskMetadataText = (metadata: Record<string, unknown> | undefined): string | null => (
    resolveTaskMetadataMessage(metadata)
);

export const resolveQueueRecordMetadataMessage = (task: TaskQueueRecord): string | null => (
    resolveTaskMetadataText(task.metadata)
);