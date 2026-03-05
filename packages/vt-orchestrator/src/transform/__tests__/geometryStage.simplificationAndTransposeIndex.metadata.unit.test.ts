import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord } from '~/types/types';

const { updateTaskMock } = vi.hoisted(() => ({
  updateTaskMock: vi.fn(async () => undefined),
}));

vi.mock('~/task/taskQueue', () => ({
  VtTaskQueueDb: class {
    tasks = {
      get: async () => undefined,
    };
  },
  updateTask: updateTaskMock,
}));

vi.mock('../createGeometryStageHandler/runGeometryStageOutputPhase.js', () => ({
  runGeometryStageOutputPhase: vi.fn(async () => ({
    status: 'completed',
    progress: 100,
    outputData: {
      processedPolygons: 1,
      totalPolygons: 1,
    },
  })),
}));

vi.mock('../createGeometryStageHandler/helpers/core.js', () => ({
  TASKDEBUG_BUILD_TAG: 'test',
  TRANSFORM_TASK_UPDATE_TIMEOUT_MS: 1000,
  TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS: 1000,
  createGeometryOps: () => ({
    simplifyFeature: async (feature: unknown) => feature,
  }),
  emitTransformTrace: vi.fn(),
  isTaskDebugLoggingEnabled: () => false,
  normalizeTraceLogLevel: () => 'summary',
  resolveRetryVertexLimit: () => 6553,
  resolveSimplifyAlgorithm: () => 'turf',
  resolveTransformTolerance: () => 1,
  withTimeout: async <T>({ promise }: { promise: Promise<T> }) => await promise,
}));

vi.mock('../createGeometryStageHandler/helpers/analysis.js', () => ({
  analyzeGeometryIssues: vi.fn(),
  isGeometryBooleanValid: vi.fn(),
  filterFeaturesByAspectRatioAndArea: async (features: unknown[]) => features,
  buildErrorLineFeatures: vi.fn(),
  resolveFeatureIdentifier: vi.fn(() => 'feature-1'),
}));

const collection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
  }],
};

vi.mock('../createGeometryStageHandler/helpers/validation.js', () => ({
  decodeSourceCacheByFormat: vi.fn(async () => collection),
  countPolygonsFromGeometry: vi.fn(() => 1),
  countVerticesFromGeometry: vi.fn(() => 5),
  simplifyOnlyCollection: vi.fn(async () => collection),
  repairCollectionSelfIntersections: vi.fn(() => ({
    collection,
    repairedFeatureCount: 0,
  })),
}));

vi.mock('../createGeometryStageHandler/helpers/runtime.js', () => ({
  assertNotAborted: vi.fn(),
  buildCollectionDiagnostics: vi.fn(() => ''),
  formatArea: vi.fn(() => ''),
  formatAverage: vi.fn(() => ''),
  formatToleranceForDisplay: (value: number) => value,
  runStageWithLabel: async (_label: string, fn: () => unknown) => await fn(),
  runWithStallTimeout: async <T>({ promise }: { promise: Promise<T> }) => await promise,
}));

vi.mock('../createGeometryStageHandler/retrySimplifyWithinVertexLimit.js', () => ({
  countVertexLimitOverages: vi.fn(() => ({
    overLimitFeatureCount: 0,
    maxVertexCount: 5,
  })),
  findBaseToleranceByBisection: vi.fn(),
  retrySimplifyFeatureWithinVertexLimit: vi.fn(),
  selectMaxVertexFeature: vi.fn(),
}));

vi.mock('../createGeometryStageHandler/helpers/resolveSimplifyToleranceProfile.js', () => ({
  resolveSimplifyToleranceProfile: () => ({
    multiplierByBand: [1],
    minRatioByBand: [1],
    maxRatioByBand: [1],
    toleranceSearchMaxIterations: 8,
  }),
}));

import { createGeometryStageHandler } from '../createGeometryStageHandler/createGeometryStageHandler.js';

describe('geometry stage simplificationAndTransposeIndex metadata notifications', () => {
  beforeEach(() => {
    updateTaskMock.mockClear();
  });

  it('notifies vertexLimitValidation and returns effectiveTolerance in metadata', async () => {
    const handler = createGeometryStageHandler({
      ephemeralDB: {
        sourceCache: {
          get: async () => ({
            format: 'flatgeobuf',
            compression: 'none',
            data: new ArrayBuffer(8),
            polygonCount: 1,
            vertexCount: 5,
          }),
        },
        geometryCacheMeta: { put: async () => undefined },
        geometryErrors: { bulkPut: async () => undefined },
      } as never,
      geometryConfig: {
        geometryEngine: 'turf',
        simplifyAlgorithm: 'turf',
      } as never,
      bands: [{ bandIndex: 0, zMin: 0, zMax: 5, zBase: 0 }],
    });

    const task = {
      taskId: 'geometry-task-1',
      nodeId: 'node-1' as NodeId,
      stage: 'geometry',
      status: 'queued',
      index: 0,
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      inputData: {
        sourceCacheId: 'source-cache-1',
        sourceCacheFormat: 'flatgeobuf',
        sourceCacheCompression: 'none',
        bandIndex: 0,
        domainType: 'shape',
        sourceKey: 'jp-adm0',
        sourceBaseTolerance: 0.2,
        countryCode: 'JP',
        adminLevel: 0,
      },
    } satisfies TaskQueueRecord;

    const result = await handler(task);

    expect(result.status).toBe('completed');
    expect((result.metadata as Record<string, unknown>).effectiveTolerance).toBe(0.2);

    const metadataUpdates = updateTaskMock.mock.calls
      .map((call) => call[2] as { metadata?: Record<string, unknown> })
      .map((updates) => updates.metadata)
      .filter((metadata): metadata is Record<string, unknown> => Boolean(metadata));

    const vertexValidationUpdates = metadataUpdates
      .map((metadata) => metadata.vertexLimitValidation as Record<string, unknown> | undefined)
      .filter((value): value is Record<string, unknown> => Boolean(value));

    expect(vertexValidationUpdates.length).toBeGreaterThan(0);
    expect(vertexValidationUpdates.some((entry) => entry.state === 'start')).toBe(true);
    expect(vertexValidationUpdates.some((entry) => entry.state === 'done')).toBe(true);
    expect(vertexValidationUpdates.every((entry) => entry.effectiveTolerance === 0.2)).toBe(true);
  });
});
