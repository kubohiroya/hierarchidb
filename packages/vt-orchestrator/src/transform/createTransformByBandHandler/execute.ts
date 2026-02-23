import type { Feature, FeatureCollection } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload } from '../../../../build-api';
import { applyFeatureFiltering } from '@hierarchidb/gis-sdk';
import type { ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import type { TransformByBandStageContext } from '~/contexts';
import type { StageHandler, StageHandlerResult, TransformByBandTaskInput } from '~/types/types';
import { VtTaskQueueDb, updateTask } from '~/task/taskQueue';
import { runTransformByBandOutputPhase } from './transformByBandOutput.js';
import {
  TASKDEBUG_BUILD_TAG,
  TRANSFORM_TASK_UPDATE_TIMEOUT_MS,
  TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS,
  createGeometryOps,
  emitTransformTrace,
  isTaskDebugLoggingEnabled,
  normalizeTraceLogLevel,
  resolveRetryVertexLimit,
  resolveSimplifyAlgorithm,
  resolveTransformTolerance,
  withTimeout,
} from './helpers/core.js';
import {
  analyzeGeometryIssues,
  isGeometryBooleanValid,
  filterFeaturesByAspectRatioAndArea,
  buildErrorLineFeatures,
  resolveFeatureIdentifier,
} from './helpers/analysis.js';
import {
  decodeFetchCacheByFormat,
  countPolygonsFromGeometry,
  countVerticesFromGeometry,
  simplifyOnlyCollection,
  repairCollectionSelfIntersections,
} from './helpers/validation.js';
import {
  assertNotAborted,
  buildCollectionDiagnostics,
  formatArea,
  formatAverage,
  formatToleranceForDisplay,
  runStageWithLabel,
  runWithStallTimeout,
} from './helpers/runtime.js';
import {
  countVertexLimitOverages,
  retrySimplifyFeatureWithinVertexLimit,
} from './transformByBandRetrySimplify.js';

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  if (isTaskDebugLoggingEnabled()) {
    console.debug('[ShapeTransform][TaskDebug] handler created', {
      tag: TASKDEBUG_BUILD_TAG,
      bandCount: context.bands.length,
      geometryEngine: context.transformConfig.geometryEngine ?? 'turf',
    });
  }
  const {
    ephemeralDB,
    transformConfig,
    bands,
    abortSignal,
    featureIdAllowlist,
  } = context;
  const taskQueue = new VtTaskQueueDb();
  const taskProgressRange = {
    transformStart: 0,
    fetchStart: 1,
    fetchEnd: 10,
    decodeStart: 11,
    decodeEnd: 20,
    prepareStart: 21,
    prepareEnd: 30,
    simplifyStart: 31,
    simplifyEnd: 80,
    outputBuildStart: 81,
    outputBuildEnd: 90,
    outputCountsStart: 91,
    outputCountsEnd: 95,
    encodeStart: 96,
    encodeEnd: 99,
    cachePutStart: 99,
  } as const;
  const normalizeDisplayToken = (value: string): string => (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
  const resolvePhaseDisplay = (phase: string): TaskDisplayPayload => {
    const separator = phase.lastIndexOf(':');
    const rawState = separator >= 0 ? phase.slice(separator + 1) : 'progress';
    const phaseState = rawState === 'start' || rawState === 'done' || rawState === 'progress'
      ? rawState
      : 'progress';
    const phaseCode = separator >= 0 ? phase.slice(0, separator) : phase;
    const normalizedPhaseCode = normalizeDisplayToken(phaseCode);
    return {
      kind: 'phase',
      phaseCode,
      phaseState,
      key: `stage.taskPhase.${normalizedPhaseCode}_${phaseState}`,
    };
  };
  const normalizePhaseProgress = (value: number): number => {
    if (!Number.isFinite(value)) return value;
    // Keep phase updates below 100 so completion message is finalized only by completed status updates.
    return Math.min(99, Math.max(0, Math.round(value)));
  };
  const updateTaskStrict = async (
    taskId: string,
    updates: Parameters<typeof updateTask>[2],
    operation: string,
  ): Promise<void> => {
    try {
      await withTimeout({
        taskId,
        operation,
        timeoutMs: TRANSFORM_TASK_UPDATE_TIMEOUT_MS,
        promise: updateTask(taskQueue, taskId, updates),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`task update failed: ${reason}`);
    }
  };
  const reportPolygonProgress = async (
    taskId: string,
    processedPolygons: number,
    totalPolygons: number,
    message?: string,
  ): Promise<void> => {
    const total = Math.max(0, Math.round(totalPolygons));
    const processed = Math.max(0, Math.round(processedPolygons));
    await updateTaskStrict(taskId, {
      ...(message ? { message } : {}),
      outputData: {
        processedPolygons: processed,
        totalPolygons: total,
      },
    }, 'progress:update');
  };
  const updateTaskPhase = async (
    taskId: string,
    phase: string,
    progress?: number,
    options?: {
      key?: string;
      params?: TaskDisplayPayload['params'];
    },
  ): Promise<void> => {
    const display = resolvePhaseDisplay(phase);
    if (options?.key) {
      display.key = options.key;
    }
    if (options?.params) {
      display.params = options.params;
    }
    await updateTaskStrict(taskId, {
      display,
      ...(progress !== undefined ? { progress: normalizePhaseProgress(progress) } : {}),
    }, `phase:update:${phase}`);
  };
  const updateSimplifyAttemptPhase = async (
    taskId: string,
    params: {
      attempt: number;
      tolerance: number;
      progress?: number;
      phaseState?: 'start' | 'progress' | 'done';
    },
  ): Promise<void> => {
    await updateTaskStrict(taskId, {
      display: {
        kind: 'phase',
        key: 'stage.taskPhase.simplifyAttempt',
        phaseCode: 'simplify-attempt',
        phaseState: params.phaseState ?? 'progress',
        params: {
          attempt: params.attempt,
          tolerance: formatToleranceForDisplay(params.tolerance),
        },
      },
      ...(params.progress !== undefined ? { progress: normalizePhaseProgress(params.progress) } : {}),
    }, 'phase:update:simplify-attempt');
  };
  const updateRetrySimplifyAttemptPhase = async (
    taskId: string,
    params: {
      featureIndex: number;
      featureTotal: number;
      attempt: number;
      attemptTotal: number;
      tolerance: number;
    },
  ): Promise<void> => {
    await updateTaskStrict(taskId, {
      display: {
        kind: 'phase',
        key: 'stage.taskPhase.retrySimplifyFeature',
        phaseCode: 'retry-simplify-feature',
        phaseState: 'progress',
        params: {
          featureIndex: params.featureIndex,
          featureTotal: params.featureTotal,
          attempt: params.attempt,
          attemptTotal: params.attemptTotal,
          tolerance: formatToleranceForDisplay(params.tolerance),
        },
      },
    }, 'phase:update:retry-simplify-feature');
  };
  // Feature filtering is intentionally disabled during transform stage while investigating geometry distortion.
  const enableFeatureFiltering = false;
  const toleranceByBand = transformConfig.toleranceByBand;
  if (!Array.isArray(toleranceByBand) || toleranceByBand.length === 0) {
    throw new Error('transform requires toleranceByBand');
  }
  const configuredRetryToleranceStep = typeof transformConfig.retryToleranceStep === 'number'
    && Number.isFinite(transformConfig.retryToleranceStep)
    ? Math.min(2, Math.max(0, transformConfig.retryToleranceStep))
    : 0.01;
  const simplifyAlgorithm = resolveSimplifyAlgorithm(transformConfig.simplifyAlgorithm);
  const geometryEngine = transformConfig.geometryEngine ?? 'turf';
  const preserveTopology = transformConfig.preserveTopology ?? true;
  const traceLogLevel = normalizeTraceLogLevel(transformConfig.executionLogLevel);
  const intakeGuardConfig = {
    validationLevel: 'off' as const,
    dedupeEpsilon: 0,
    minRingAreaThreshold: 0,
    normalizeRingOrientation: false,
    keepBaselineSnapshot: false,
  } as const;
  if (geometryEngine !== 'turf') {
    throw new Error(`transform failed: unknown geometryEngine (${String(geometryEngine)})`);
  }
  const geometryOps = createGeometryOps(geometryEngine);
  const bandMap = new Map(bands.map((band) => [band.bandIndex, band] as const));
  let debugTaskId: string | null = null;
  let debugTaskStartedAt: number | null = null;
  let debugNodeId: NodeId | null = null;
  let debugSelectionLogged = false;
  let firstTaskLogged = false;
  const RETRY_TOLERANCE_STEP_MULTIPLIER = 4;
  const MAX_RETRY_STEPS = 12;
  const debugResetAfterMs = 30000;
  const readHeapUsageRatio = (): number | null => {
    const performance = (globalThis as {
      performance?: {
        memory?: {
          usedJSHeapSize?: number;
          jsHeapSizeLimit?: number;
        };
      };
    }).performance;
    const memory = performance?.memory;
    const used = memory?.usedJSHeapSize;
    const limit = memory?.jsHeapSizeLimit;
    if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0) return null;
    if (!Number.isFinite(used) || !Number.isFinite(limit)) return null;
    return Math.round((used / limit) * 1000) / 1000;
  };

  return async (task): Promise<StageHandlerResult> => {
    const taskId = task.taskId;
    if (!firstTaskLogged && isTaskDebugLoggingEnabled()) {
      firstTaskLogged = true;
      console.debug('[ShapeTransform][TaskDebug] handler first task', {
        tag: TASKDEBUG_BUILD_TAG,
        nodeId: task.nodeId,
        taskId,
        stage: task.stage,
        inputKeys: Object.keys(task.inputData ?? {}),
      });
    }
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform failed: task input is missing' };
    }
    const band = bandMap.get(input.bandIndex);
    if (!band) {
      return { status: 'failed', errorMessage: `transform failed: unknown bandIndex (${input.bandIndex})` };
    }
    const tolerance = resolveTransformTolerance(toleranceByBand, band.bandIndex, 0.1);
    const bandTolerance = toleranceByBand[band.bandIndex];
    if (bandTolerance === undefined || tolerance !== bandTolerance) {
      console.info('[ShapeTransform][Tolerance]', JSON.stringify({
        nodeId: task.nodeId,
        taskId,
        sourceKey: input.sourceKey,
        adminLevel: input.adminLevel,
        bandIndex: input.bandIndex,
        zTarget: band.zMax,
        baseTolerance: bandTolerance,
        appliedTolerance: tolerance,
      }));
    }
    emitTransformTrace(traceLogLevel, 'summary', 'task-config', {
      sessionId: String(task.nodeId),
      taskId,
      stage: 'transform',
      simplifyAlgorithm,
      preserveTopology,
      tolerance,
      fetchIntakeGuard: intakeGuardConfig,
    });

    let workingCollection: FeatureCollection | null = null;
    let simplified: FeatureCollection | null = null;
    let outputCollection: FeatureCollection | null = null;
    let stageLabel = 'start';
    const setStageLabel = (value: string): void => {
      stageLabel = value;
    };
    let inputPolygonCount = 0;
    let inputVertexCount = 0;
    const now = Date.now();
    const debugTaskLoggingEnabled = isTaskDebugLoggingEnabled();
    if (
      debugTaskLoggingEnabled
      && (!debugTaskId || !debugTaskStartedAt || now - debugTaskStartedAt > debugResetAfterMs || debugNodeId !== task.nodeId)
    ) {
      debugTaskId = taskId;
      debugTaskStartedAt = now;
      debugNodeId = task.nodeId;
      debugSelectionLogged = false;
    }
    const isDebugTask = debugTaskLoggingEnabled && debugTaskId === taskId;
    const getElapsedMs = () => (debugTaskStartedAt ? Date.now() - debugTaskStartedAt : null);
    const logDebugPhase = (phase: string, details?: Record<string, unknown>) => {
      if (!isDebugTask) return;
      console.debug('[ShapeTransform][TaskDebug]', {
        nodeId: task.nodeId,
        taskId,
        phase,
        stageLabel,
        elapsedMs: getElapsedMs(),
        heapUsedRatio: readHeapUsageRatio(),
        ...details,
      });
    };
    let debugHeartbeat: ReturnType<typeof setInterval> | null = null;
    if (isDebugTask) {
      if (!debugSelectionLogged) {
        debugSelectionLogged = true;
        console.debug('[ShapeTransform][TaskDebug] selection', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          zTarget: band.zMax,
        });
      }
      logDebugPhase('task-start', {
        bandIndex: input.bandIndex,
        zTarget: band.zMax,
        sourceKey: input.sourceKey,
        adminLevel: input.adminLevel,
        fetchCacheId: input.fetchCacheId,
        domainType: input.domainType,
        tolerance,
      });
      debugHeartbeat = setInterval(() => {
        logDebugPhase('task-heartbeat');
      }, 5000);
    }

    try {
      stageLabel = 'fetch:cache';
      logDebugPhase('fetch-cache:start', { fetchCacheId: input.fetchCacheId });
      await updateTaskPhase(taskId, 'transform:start', taskProgressRange.transformStart);
      await updateTaskPhase(taskId, 'fetch-cache:start', taskProgressRange.fetchStart);
      assertNotAborted(abortSignal);
      let fetchWaitTimer: ReturnType<typeof setInterval> | null = null;
      let fetchWaitStartedAt: number | null = null;
      if (isDebugTask) {
        fetchWaitStartedAt = Date.now();
        fetchWaitTimer = setInterval(() => {
          const elapsedMs = fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null;
          console.debug('[ShapeTransform][TaskDebug] fetch-cache:waiting', {
            nodeId: task.nodeId,
            taskId,
            fetchCacheId: input.fetchCacheId,
            elapsedMs,
            db: {
              name: (ephemeralDB as { name?: string }).name ?? null,
              isOpen: typeof (ephemeralDB as { isOpen?: () => boolean }).isOpen === 'function'
                ? (ephemeralDB as { isOpen: () => boolean }).isOpen()
                : null,
            },
          });
        }, 5000);
      }
      const fetchCache = await ephemeralDB.fetchCache.get(input.fetchCacheId);
      if (fetchWaitTimer) {
        clearInterval(fetchWaitTimer);
      }
      if (!fetchCache) {
        return { status: 'failed', errorMessage: 'transform failed: fetch cache not found' };
      }
      const noOpBand0Topojson = input.bandIndex === 0 && band.zMin <= 2
        && fetchCache.format === 'topojson'
        && simplifyAlgorithm === 'topojson';
      if (noOpBand0Topojson) {
        const fallbackPolygonCount = (() => {
          if (typeof input.inputPolygonCount === 'number' && Number.isFinite(input.inputPolygonCount)) {
            return input.inputPolygonCount > 0 ? Math.round(input.inputPolygonCount) : 0;
          }
          const fetchCachePolygonCount = typeof fetchCache.polygonCount === 'number' && Number.isFinite(fetchCache.polygonCount)
            ? Math.round(fetchCache.polygonCount)
            : 0;
          return fetchCachePolygonCount > 0 ? fetchCachePolygonCount : 0;
        })();
        return {
          status: 'completed',
          progress: 100,
          message: `skipped: topojson band0 no-op (zMin=${band.zMin})`,
          display: {
            kind: 'skip',
            key: 'stage.taskSkip.noOp',
            params: {
              bandIndex: input.bandIndex,
              bandMinZoom: band.zMin,
            },
          },
          outputData: {
            processedPolygons: fallbackPolygonCount,
            totalPolygons: fallbackPolygonCount,
          },
        };
      }
      logDebugPhase('fetch-cache:done', {
        format: fetchCache.format,
        compression: fetchCache.compression ?? null,
        byteLength: fetchCache.data.byteLength,
        elapsedMs: fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null,
      });
      await updateTaskPhase(taskId, 'fetch-cache:done', taskProgressRange.fetchEnd);

      stageLabel = 'decode';
      logDebugPhase('decode:start', {
        format: fetchCache.format,
        compression: fetchCache.compression ?? null,
      });
      await updateTaskPhase(taskId, 'decode:start', taskProgressRange.decodeStart);
      assertNotAborted(abortSignal);
      const decodeStartedAt = Date.now();
      let decodeProgressActive = true;
      const publishDecodeProgress = async (): Promise<void> => {
        if (!decodeProgressActive) return;
        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - decodeStartedAt) / 1000));
        await updateTaskPhase(taskId, 'decode:progress', taskProgressRange.decodeStart, {
          key: 'stage.taskPhase.decodeProgress',
          params: { elapsedSeconds },
        });
      };
      const decodeProgressTimer = setInterval(() => {
        void publishDecodeProgress();
      }, TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS);
      let collection: FeatureCollection | null = null;
      try {
        const skipDecodeTopojsonSimplify = fetchCache.format === 'topojson' && simplifyAlgorithm === 'topojson';
        collection = await runStageWithLabel('decode', () => decodeFetchCacheByFormat({
          buffer: fetchCache.data,
          format: fetchCache.format,
          compression: fetchCache.compression,
          zTarget: band.zMax,
          toleranceK: tolerance,
          quantize: transformConfig.quantize,
          simplifyAlgorithm,
          skipSimplification: skipDecodeTopojsonSimplify,
        }));
      } finally {
        decodeProgressActive = false;
        clearInterval(decodeProgressTimer);
      }
      if (!collection || collection.features.length === 0) {
        return { status: 'failed', errorMessage: 'transform failed: empty fetch cache' };
      }
      logDebugPhase('decode:done', { featureCount: collection.features.length });
      await updateTaskPhase(taskId, 'decode:done', taskProgressRange.decodeEnd);

      if (featureIdAllowlist && featureIdAllowlist.size > 0) {
        stageLabel = 'recycling-filter';
        await updateTaskPhase(taskId, 'recycling-filter:start', taskProgressRange.prepareStart);
        const hasFeatureIds = collection.features.some((feature) => {
          const props = feature?.properties as Record<string, unknown> | undefined;
          return typeof props?.__hdbFeatureId === 'string' && props.__hdbFeatureId.length > 0;
        });
        if (!hasFeatureIds) {
          console.warn('[ShapeTransform] recycling allowlist ignored (missing __hdbFeatureId)', {
            nodeId: task.nodeId,
            taskId,
            sourceKey: input.sourceKey,
          });
        } else {
          const filteredFeatures = collection.features.filter((feature) => {
            const props = feature?.properties as Record<string, unknown> | undefined;
            const featureId = typeof props?.__hdbFeatureId === 'string' ? props.__hdbFeatureId : null;
            return featureId ? featureIdAllowlist.has(featureId) : false;
          });
          if (filteredFeatures.length === 0) {
            await updateTaskPhase(taskId, 'recycling-filter:done', taskProgressRange.prepareStart);
            await reportPolygonProgress(taskId, 0, 0);
            return {
              status: 'completed',
              progress: 100,
              display: {
                kind: 'skip',
                key: 'stage.taskSkip.noRecyclingFeatures',
                params: {},
              },
              outputData: {
                processedPolygons: 0,
                totalPolygons: 0,
              },
            };
          }
          collection = { ...collection, features: filteredFeatures };
        }
        await updateTaskPhase(taskId, 'recycling-filter:done', taskProgressRange.prepareStart);
      }
      workingCollection = collection;
      if (enableFeatureFiltering && transformConfig.enableFeatureFiltering) {
        stageLabel = 'filter:featureFiltering';
        await updateTaskPhase(taskId, 'filtering:start', taskProgressRange.decodeEnd);
        assertNotAborted(abortSignal);
        const filtered = await runStageWithLabel('filter:featureFiltering', () => applyFeatureFiltering(
          workingCollection,
          {
            minArea: transformConfig.featureAreaThreshold,
            featureFilterMethod: transformConfig.featureFilterMethod,
            minVertexCountForAreaFilter: transformConfig.minVertexCountForAreaFilter,
            hybridFilterConfig: transformConfig.hybridFilterConfig,
          },
          geometryEngine,
        ));
        if (filtered && typeof filtered === 'object' && (filtered as FeatureCollection).type === 'FeatureCollection') {
          workingCollection = filtered as FeatureCollection;
        }
        const filterTarget = workingCollection;
        if (!filterTarget) {
          return { status: 'failed', errorMessage: 'transform failed: empty working collection before filters' };
        }
        stageLabel = 'filter:aspectArea';
        const filteredFeatures = await runStageWithLabel('filter:aspectArea', () => filterFeaturesByAspectRatioAndArea(
          filterTarget.features,
          transformConfig.aspectRatioThreshold,
          transformConfig.areaThreshold,
          geometryOps,
        ));
        workingCollection = { ...filterTarget, features: filteredFeatures };
        await updateTaskPhase(taskId, 'filtering:done', taskProgressRange.decodeEnd);
      }

      assertNotAborted(abortSignal);
      const inputCollection = workingCollection;
      if (!inputCollection) {
        return { status: 'failed', errorMessage: 'transform failed: empty working collection' };
      }
      const inputFeatureCount = inputCollection.features.length;
      const inputMissingGeometry = inputCollection.features.filter((feature) => !feature?.geometry).length;
      const readNonNegativeCount = (value: unknown): number | null => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        if (value < 0) return null;
        return Math.round(value);
      };
      const readFeaturePrecomputedCount = (
        feature: Feature | null | undefined,
        key: '__hdbFetchPolygonCount' | '__hdbFetchVertexCount',
      ): number => {
        const properties = feature?.properties as Record<string, unknown> | undefined;
        const raw = properties?.[key];
        return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
      };
      inputPolygonCount = readNonNegativeCount(input.inputPolygonCount)
        ?? readNonNegativeCount(fetchCache.polygonCount)
        ?? 0;
      inputVertexCount = readNonNegativeCount(input.inputVertexCount)
        ?? readNonNegativeCount(fetchCache.vertexCount)
        ?? 0;
      if (featureIdAllowlist && featureIdAllowlist.size > 0) {
        const allowlistPolygonCount = inputCollection.features.reduce(
          (sum, feature) => sum + readFeaturePrecomputedCount(feature, '__hdbFetchPolygonCount'),
          0,
        );
        const allowlistVertexCount = inputCollection.features.reduce(
          (sum, feature) => sum + readFeaturePrecomputedCount(feature, '__hdbFetchVertexCount'),
          0,
        );
        inputPolygonCount = allowlistPolygonCount;
        inputVertexCount = allowlistVertexCount;
      }
      await reportPolygonProgress(taskId, 0, inputPolygonCount);
      const shouldCollectBaselineMetrics = false;
      if (shouldCollectBaselineMetrics) {
        // Reserved for future: consume fetch-stage precomputed baseline metrics only.
      }
      if (input.adminLevel === 0 && band.zMax >= 6) {
        const samples = inputCollection.features.slice(0, 5).map((feature, index) => {
          const props = feature?.properties as Record<string, unknown> | undefined;
          const id = feature?.id
            ?? props?.id
            ?? props?.boundaryID
            ?? props?.boundaryISO
            ?? props?.ISO
            ?? props?.code
            ?? `${input.sourceKey}:${index}`;
          return {
            index,
            id,
            name: props?.boundaryName ?? props?.name ?? null,
            vertices: countVerticesFromGeometry(feature?.geometry ?? null),
            polygons: countPolygonsFromGeometry(feature?.geometry ?? null),
          };
        });
        console.info('[ShapeTransform][Admin0FeatureSample]', JSON.stringify({
          nodeId: task.nodeId,
          taskId,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          samples,
        }));
      }
      const readHeapSnapshot = () => {
        const performance = (globalThis as {
          performance?: {
            memory?: {
              usedJSHeapSize?: number;
              totalJSHeapSize?: number;
              jsHeapSizeLimit?: number;
            };
          };
        }).performance;
        const memory = performance?.memory;
        if (!memory) return null;
        return {
          used: memory.usedJSHeapSize ?? null,
          total: memory.totalJSHeapSize ?? null,
          limit: memory.jsHeapSizeLimit ?? null,
        };
      };
      const retryVertexLimit = resolveRetryVertexLimit(input.countryCode);
      const formatTolerance = (value: number): string => Number.isFinite(value) ? value.toFixed(6) : '-';
      const summarizeVertexLimit = (collection: FeatureCollection | null): {
        featureCount: number;
        overLimitFeatureCount: number;
        maxVertexCount: number;
      } | null => {
        if (!collection) return null;
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        for (const feature of collection.features) {
          if (!feature?.geometry) continue;
          const vertexCount = countVerticesFromGeometry(feature.geometry);
          maxVertexCount = Math.max(maxVertexCount, vertexCount);
          if (vertexCount >= retryVertexLimit) {
            overLimitFeatureCount += 1;
          }
        }
        return {
          featureCount: collection.features.length,
          overLimitFeatureCount,
          maxVertexCount,
        };
      };
      const shouldDeferSimplifyToVt = fetchCache.format === 'topojson' && simplifyAlgorithm === 'topojson';
      const simplifyAttempt = 1;
      try {
        assertNotAborted(abortSignal);
        const simplifyStartAt = Date.now();
        stageLabel = 'simplify-only';
        logDebugPhase('simplify:start', {
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
        });
        console.log('[ShapeTransform][SimplifyOnlyMetrics] start', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
          missingGeometry: inputMissingGeometry,
          algorithm: simplifyAlgorithm,
          fetchFormat: fetchCache.format,
          heap: readHeapSnapshot(),
        });
        let processedPolygonCount = 0;
        let lastReportAt = 0;
        const reportProgressMaybe = async (force: boolean) => {
          const now = Date.now();
          if (!force && now - lastReportAt < 2000) return;
          lastReportAt = now;
          await reportPolygonProgress(taskId, processedPolygonCount, inputPolygonCount);
        };
        await updateSimplifyAttemptPhase(taskId, {
          attempt: simplifyAttempt,
          tolerance,
          phaseState: 'start',
          progress: taskProgressRange.simplifyStart,
        });
        emitTransformTrace(traceLogLevel, 'summary', 'simplify-start', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'simplify',
          algorithm: simplifyAlgorithm,
          tolerance,
          preserveTopology,
          inputFeatureCount,
          inputPolygonCount,
          inputVertexCount,
        });
        if (shouldDeferSimplifyToVt) {
          simplified = inputCollection;
          processedPolygonCount = inputPolygonCount;
          logDebugPhase('simplify:skipped', {
            mode: 'topojson',
            algorithm: simplifyAlgorithm,
            fetchFormat: fetchCache.format,
            featureCount: simplified.features.length,
          });
          await updateSimplifyAttemptPhase(taskId, {
            attempt: simplifyAttempt,
            tolerance,
            phaseState: 'done',
            progress: taskProgressRange.simplifyEnd,
          });
        } else {
          const simplifyPromise = runStageWithLabel('simplify-only', () => (
            simplifyOnlyCollection(inputCollection, band.zMax, tolerance, geometryOps)
          ));
          simplified = await runWithStallTimeout({
            promise: simplifyPromise,
            stage: 'simplify-only',
            nodeId: String(task.nodeId),
            taskId,
            timeoutMs: 300000,
            getLastProgressAt: () => Date.now(),
          });
          processedPolygonCount = inputPolygonCount;
        }
        logDebugPhase('simplify:done', {
          featureCount: simplified?.features.length ?? 0,
          polygonCount: inputPolygonCount,
          algorithm: simplifyAlgorithm,
          skipped: shouldDeferSimplifyToVt,
        });
        console.log('[ShapeTransform][SimplifyOnlyMetrics] done', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          durationMs: Date.now() - simplifyStartAt,
          processedPolygons: processedPolygonCount,
          totalPolygons: inputPolygonCount,
          algorithm: simplifyAlgorithm,
          skipped: shouldDeferSimplifyToVt,
          heap: readHeapSnapshot(),
        });
        await reportProgressMaybe(true);
        await updateTaskPhase(taskId, 'simplify-only:done', taskProgressRange.simplifyEnd);
        if (!simplified || simplified.features.length === 0) {
          const errorRecords: ShapeTransformErrorRecord[] = [];
          const recordLimit = 200;
          for (const [featureIndex, feature] of inputCollection.features.entries()) {
            if (errorRecords.length >= recordLimit) break;
            if (!feature?.geometry) continue;
            const rawFeatureId = feature.id
              ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
            const featureId = rawFeatureId ? String(rawFeatureId) : `${input.sourceKey}:${featureIndex}`;
            const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
            const recordPolygonCount = lineFeaturesCandidate?.polygonCount
              ?? countPolygonsFromGeometry(feature.geometry);
            const recordRingCount = lineFeaturesCandidate?.ringCount ?? 0;
            errorRecords.push({
              id: `${task.taskId}:empty:${featureIndex}`,
              nodeId: task.nodeId,
              taskId: task.taskId,
              stage: 'transform',
              bandIndex: input.bandIndex,
              sourceKey: input.sourceKey,
              countryCode: input.countryCode,
              adminLevel: input.adminLevel,
              featureId,
              featureIndex,
              geometryType: lineFeaturesCandidate?.geometryType ?? feature.geometry.type,
              polygonCount: recordPolygonCount,
              ringCount: recordRingCount,
              polygonErrorCount: recordPolygonCount,
              ringErrorCount: recordRingCount,
              message: 'simplify produced empty collection',
              createdAt: Date.now(),
              lineFeatures: {
                type: 'FeatureCollection',
                features: lineFeaturesCandidate?.features ?? [],
              },
            });
          }
          if (errorRecords.length > 0) {
            try {
              await ephemeralDB.transformErrors.bulkPut(errorRecords);
              if (inputCollection.features.length > errorRecords.length) {
                console.warn('[ShapeTransform] empty simplify error records truncated', {
                  nodeId: task.nodeId,
                  taskId: task.taskId,
                  limit: recordLimit,
                  totalFeatures: inputCollection.features.length,
                });
              }
            } catch (storageError) {
              console.warn('[ShapeTransform] failed to persist empty simplify error records', storageError);
            }
          }
          await reportPolygonProgress(task.taskId, inputPolygonCount, inputPolygonCount);
          return {
            status: 'completed',
            progress: 100,
            display: {
              kind: 'skip',
              key: 'stage.taskSkip.emptyAfterSimplify',
              params: {
                inputFeatures: inputFeatureCount,
                inputPolygons: inputPolygonCount,
              },
            },
            outputData: {
              processedPolygons: inputPolygonCount,
              totalPolygons: inputPolygonCount,
            },
          };
        }
      } catch (error) {
        if (abortSignal?.aborted) {
          throw error;
        }
        const err = error instanceof Error ? error.message : String(error);
        let errorFeatureCount = 0;
        let errorPolygonCount = 0;
        let invalidRingCount = 0;
        let openRingCount = 0;
        let emptyRingCount = 0;
        let nonFiniteCoordCount = 0;
        let invalidFeatureCount = 0;
        let minRingVertices: number | null = null;
        let maxRingVertices: number | null = null;
        let ringVertexTotal = 0;
        let ringCount = 0;
        let degenerateRingCount = 0;
        let duplicateVertexCount = 0;
        let selfIntersectionCount = 0;
        let minRingArea: number | null = null;
        let maxRingArea: number | null = null;
        const sampleDetails: string[] = [];
        const analysisErrors: string[] = [];
        const errorRecords: ShapeTransformErrorRecord[] = [];
        for (const [featureIndex, feature] of inputCollection.features.entries()) {
          assertNotAborted(abortSignal);
          if (!feature?.geometry) continue;
          try {
            simplifyOnlyCollection(
              { type: 'FeatureCollection', features: [feature] },
              band.zMax,
              tolerance,
              geometryOps,
            );
          } catch (featureError) {
            errorFeatureCount += 1;
            const featureMessage = featureError instanceof Error ? featureError.message : String(featureError);
            const rawFeatureId = feature.id
              ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
            const recordFeatureId = rawFeatureId != null
              ? String(rawFeatureId)
              : `${input.sourceKey}:${featureIndex}`;
            const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, recordFeatureId);
            const recordId = `${task.taskId}:${recordFeatureId}`;
            const fallbackGeometryType = feature.geometry?.type ?? 'unknown';
            const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
            const recordPolygonCount = summary.polygonCount;
            const recordRingCount = summary.ringCount;
            const recordPolygonErrorCount = summary.errorPolygonCount > 0
              ? summary.errorPolygonCount
              : recordPolygonCount;
            const recordRingErrorCount = summary.errorRingCount > 0
              ? summary.errorRingCount
              : recordRingCount;
            try {
              stageLabel = 'counts:error-polygons';
              errorPolygonCount += await runStageWithLabel('counts:error-polygons', () => countPolygonsFromGeometry(feature.geometry));
              stageLabel = 'analysis:geometry-issues';
              invalidRingCount += summary.invalidRingCount;
              openRingCount += summary.openRingCount;
              emptyRingCount += summary.emptyRingCount;
              nonFiniteCoordCount += summary.nonFiniteCoordCount;
              degenerateRingCount += summary.degenerateRingCount;
              duplicateVertexCount += summary.duplicateVertexCount;
              selfIntersectionCount += summary.selfIntersectionCount;
              const isValid = isGeometryBooleanValid(feature.geometry, geometryOps);
              if (!isValid) {
                invalidFeatureCount += 1;
              }
              if (sampleDetails.length < 3) {
                const featureId = feature.id
                  ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined)
                  ?? `${input.sourceKey}:${sampleDetails.length}`;
                sampleDetails.push(
                  `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount} booleanValid=${isValid ? '1' : '0'}`,
                );
              }
              if (summary.minRingVertices !== null) {
                minRingVertices = minRingVertices === null
                  ? summary.minRingVertices
                  : Math.min(minRingVertices, summary.minRingVertices);
              }
              if (summary.maxRingVertices !== null) {
                maxRingVertices = maxRingVertices === null
                  ? summary.maxRingVertices
                  : Math.max(maxRingVertices, summary.maxRingVertices);
              }
              if (summary.minRingArea !== null) {
                minRingArea = minRingArea === null
                  ? summary.minRingArea
                  : Math.min(minRingArea, summary.minRingArea);
              }
              if (summary.maxRingArea !== null) {
                maxRingArea = maxRingArea === null
                  ? summary.maxRingArea
                  : Math.max(maxRingArea, summary.maxRingArea);
              }
              if (summary.avgRingVertices !== null && summary.ringCount > 0) {
                ringVertexTotal += summary.avgRingVertices * summary.ringCount;
                ringCount += summary.ringCount;
              }
            } catch (analysisError) {
              const analysisMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
              if (analysisErrors.length < 3) {
                analysisErrors.push(`analysisFailed stage=${stageLabel} ${analysisMessage}`);
              }
            }
            errorRecords.push({
              id: recordId,
              nodeId: task.nodeId,
              taskId: task.taskId,
              stage: 'transform',
              bandIndex: input.bandIndex,
              sourceKey: input.sourceKey,
              countryCode: input.countryCode,
              adminLevel: input.adminLevel,
              featureId: recordFeatureId,
              featureIndex,
              geometryType: lineFeaturesCandidate?.geometryType ?? fallbackGeometryType,
              polygonCount: recordPolygonCount,
              ringCount: recordRingCount,
              polygonErrorCount: recordPolygonErrorCount,
              ringErrorCount: recordRingErrorCount,
              message: featureMessage,
              createdAt: Date.now(),
              lineFeatures: {
                type: 'FeatureCollection',
                features: lineFeaturesCandidate?.features ?? [],
              },
            });
          }
        }
        if (errorRecords.length > 0) {
          try {
            await ephemeralDB.transformErrors.bulkPut(errorRecords);
          } catch (storageError) {
            console.warn('[ShapeTransform] failed to persist transform error details', storageError);
          }
        }
        const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
        const analysisNote = analysisErrors.length ? ` (analysisErrors=${analysisErrors.join(' | ')})` : '';
        const vertexLimitSnapshot = summarizeVertexLimit(simplified);
        const simplifySummary = vertexLimitSnapshot
          ? ` (finalVertexCount=${vertexLimitSnapshot.maxVertexCount}, overLimit=${vertexLimitSnapshot.overLimitFeatureCount}/${vertexLimitSnapshot.featureCount}, finalRetryAttempts=0, finalTolerance=${formatTolerance(tolerance)})`
          : ` (finalVertexCount=-, overLimit=-, finalRetryAttempts=0, finalTolerance=${formatTolerance(tolerance)})`;
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        return {
          status: 'failed',
          errorMessage: `transform failed: geometry simplify error (extract1/${band.zMax}) (${err}) (invalidFeatures=${errorFeatureCount}/${inputFeatureCount}, invalidPolygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}, invalidGeometries=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)}) (simplifyAttempt=${simplifyAttempt})${simplifySummary}${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}${analysisNote}`,
        };
      }
      if (!shouldDeferSimplifyToVt) {
        await updateTaskPhase(taskId, 'vertex-limit-retry:start', taskProgressRange.simplifyEnd);
        const maxRetrySteps = MAX_RETRY_STEPS;
        const resolveRetryToleranceStep = (): number => configuredRetryToleranceStep;
        const retryToleranceStep = resolveRetryToleranceStep() * RETRY_TOLERANCE_STEP_MULTIPLIER;

        const runRetrySimplifyAttempt = async (feature: Feature, nextToleranceValue: number): Promise<Feature | null> => {
          const retrySimplifyPromise = runStageWithLabel('simplify-only:retry', () => (
            geometryOps.simplifyFeature(
              feature,
              band.zMax,
              nextToleranceValue,
            )
          ));
          return await runWithStallTimeout({
            promise: retrySimplifyPromise,
            stage: 'simplify-only:retry',
            nodeId: String(task.nodeId),
            taskId,
            timeoutMs: 300000,
            getLastProgressAt: () => Date.now(),
          });
        };
        let adjustedSimplified = simplified;
        let vertexLimitStats = countVertexLimitOverages(
          adjustedSimplified,
          retryVertexLimit,
          countVerticesFromGeometry,
        );
        const retryDiagnosticsByFeatureIndex = new Map<number, {
          retryAttempts: number;
          finalTolerance: number;
          finalVertexCount: number;
        }>();
        let retryAttemptsTotal = 0;
        let retryAttemptedFeatureCount = 0;
        let maxRetryAttemptsPerFeature = 0;
        let minFinalTolerance = Number.POSITIVE_INFINITY;
        let maxFinalTolerance = Number.NEGATIVE_INFINITY;
        if (vertexLimitStats.overLimitFeatureCount > 0) {
          const nextFeatures: Feature[] = [];
          let maxVertexCount = 0;
          let overLimitFeatureCount = 0;
          for (const [featureIndex, feature] of adjustedSimplified.features.entries()) {
            if (!feature?.geometry) {
              nextFeatures.push(feature);
              continue;
            }
            const result = await retrySimplifyFeatureWithinVertexLimit({
              feature,
              baseTolerance: tolerance,
              retryVertexLimit,
              retryToleranceStep,
              maxRetrySteps,
              featureIndex: featureIndex + 1,
              featureTotal: adjustedSimplified.features.length,
              runRetrySimplifyAttempt: (nextTolerance) => runRetrySimplifyAttempt(feature, nextTolerance),
              countVerticesFromGeometry,
              updateRetrySimplifyAttemptPhase: (params) => updateRetrySimplifyAttemptPhase(taskId, params),
            });
            retryDiagnosticsByFeatureIndex.set(featureIndex, {
              retryAttempts: result.retryAttempts,
              finalTolerance: result.finalTolerance,
              finalVertexCount: result.vertexCount,
            });
            nextFeatures.push(result.feature);
            maxVertexCount = Math.max(maxVertexCount, result.vertexCount);
            if (result.overLimit) {
              overLimitFeatureCount += 1;
            }
            retryAttemptsTotal += result.retryAttempts;
            if (result.retryAttempts > 0) {
              retryAttemptedFeatureCount += 1;
            }
            maxRetryAttemptsPerFeature = Math.max(maxRetryAttemptsPerFeature, result.retryAttempts);
            if (Number.isFinite(result.finalTolerance)) {
              minFinalTolerance = Math.min(minFinalTolerance, result.finalTolerance);
              maxFinalTolerance = Math.max(maxFinalTolerance, result.finalTolerance);
            }
          }
          adjustedSimplified = {
            ...adjustedSimplified,
            features: nextFeatures,
          };
          vertexLimitStats = { maxVertexCount, overLimitFeatureCount };
        }
        const repairedSimplified = repairCollectionSelfIntersections(
          adjustedSimplified,
          geometryOps,
          geometryEngine,
        );
        if (repairedSimplified.repairedFeatureCount > 0) {
          console.info('[ShapeTransform][SimplifyOnlyMetrics] repaired self-intersections after simplify', {
            nodeId: task.nodeId,
            taskId,
            bandIndex: input.bandIndex,
            zTarget: band.zMax,
            repairedFeatures: repairedSimplified.repairedFeatureCount,
          });
        }
        simplified = repairedSimplified.collection;

        await updateTaskPhase(taskId, 'vertex-limit-validate:start', taskProgressRange.simplifyEnd);
        const simplifiedFeatureCountForLimit = simplified.features.length;
        stageLabel = 'validate:vertex-limit';
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        let finalVertexCountSummary = 0;
        let finalRetryAttemptsSummary = 0;
        let finalToleranceSummary = tolerance;
        const vertexLimitRecords: ShapeTransformErrorRecord[] = [];
        const vertexRecordLimit = 200;
        for (const [featureIndex, feature] of simplified.features.entries()) {
          if (!feature?.geometry) continue;
          const vertexCount = countVerticesFromGeometry(feature.geometry);
          if (vertexCount < retryVertexLimit) continue;
          overLimitFeatureCount += 1;
          maxVertexCount = Math.max(maxVertexCount, vertexCount);
          if (vertexLimitRecords.length >= vertexRecordLimit) continue;
          const featureId = resolveFeatureIdentifier(feature, featureIndex, input.sourceKey);
          const retryDiagnostics = retryDiagnosticsByFeatureIndex.get(featureIndex);
          const retryAttempts = retryDiagnostics?.retryAttempts ?? 0;
          const finalTolerance = retryDiagnostics?.finalTolerance ?? tolerance;
          const finalVertexCount = retryDiagnostics?.finalVertexCount ?? vertexCount;
          if (finalVertexCount > finalVertexCountSummary) {
            finalVertexCountSummary = finalVertexCount;
            finalRetryAttemptsSummary = retryAttempts;
            finalToleranceSummary = finalTolerance;
          }
          const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
          const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
          vertexLimitRecords.push({
            id: `${task.taskId}:vertex-limit:${featureIndex}`,
            nodeId: task.nodeId,
            taskId: task.taskId,
            stage: 'transform',
            issueStage: 'simplify-only',
            issueKind: 'max-vertices',
            bandIndex: input.bandIndex,
            sourceKey: input.sourceKey,
            countryCode: input.countryCode,
            adminLevel: input.adminLevel,
            featureId,
            featureIndex,
            geometryType: lineFeaturesCandidate?.geometryType ?? feature.geometry.type,
            polygonCount: summary.polygonCount,
            ringCount: summary.ringCount,
            polygonErrorCount: summary.polygonCount,
            ringErrorCount: summary.ringCount,
            message: `max vertices per feature exceeded (vertexCount=${vertexCount} finalVertexCount=${finalVertexCount} limit=${retryVertexLimit} retryAttempts=${retryAttempts} finalTolerance=${formatTolerance(finalTolerance)})`,
            createdAt: Date.now(),
            lineFeatures: {
              type: 'FeatureCollection',
              features: lineFeaturesCandidate?.features ?? [],
            },
          });
        }
        if (overLimitFeatureCount > 0) {
          const finalToleranceMinValue = Number.isFinite(minFinalTolerance) ? minFinalTolerance : tolerance;
          const finalToleranceMaxValue = Number.isFinite(maxFinalTolerance) ? maxFinalTolerance : tolerance;
          const finalVertexCount = finalVertexCountSummary > 0 ? finalVertexCountSummary : maxVertexCount;
          const finalRetryAttempts = finalVertexCountSummary > 0 ? finalRetryAttemptsSummary : maxRetryAttemptsPerFeature;
          const finalTolerance = Number.isFinite(finalToleranceSummary) ? finalToleranceSummary : tolerance;
          const retrySummary = [
            `retryAttemptsTotal=${retryAttemptsTotal}`,
            `retriedFeatures=${retryAttemptedFeatureCount}/${simplifiedFeatureCountForLimit}`,
            `maxRetriesPerFeature=${maxRetryAttemptsPerFeature}`,
            `retryStep=${formatTolerance(retryToleranceStep)}`,
            `finalToleranceRange=${formatTolerance(finalToleranceMinValue)}..${formatTolerance(finalToleranceMaxValue)}`,
          ].join(', ');
          if (vertexLimitRecords.length > 0) {
            try {
              await ephemeralDB.transformErrors.bulkPut(vertexLimitRecords);
              if (overLimitFeatureCount > vertexRecordLimit) {
                console.warn('[ShapeTransform] vertex limit error records truncated', {
                  nodeId: task.nodeId,
                  taskId: task.taskId,
                  limit: vertexRecordLimit,
                  totalFeatures: overLimitFeatureCount,
                });
              }
            } catch (storageError) {
              console.warn('[ShapeTransform] failed to persist vertex limit error records', storageError);
            }
          }
          await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
          return {
            status: 'failed',
            errorMessage: `transform failed: max vertices per feature exceeded (limit=${retryVertexLimit}, overLimit=${overLimitFeatureCount}/${simplifiedFeatureCountForLimit}, maxVertices=${maxVertexCount}, finalVertexCount=${finalVertexCount}, finalRetryAttempts=${finalRetryAttempts}, finalTolerance=${formatTolerance(finalTolerance)}, ${retrySummary})`,
          };
        }

      }

        await updateTaskPhase(taskId, 'vertex-limit-validate:done', taskProgressRange.simplifyEnd);
      return runTransformByBandOutputPhase({
        taskId,
        nodeId: task.nodeId,
        input,
        band: {
          bandIndex: input.bandIndex,
          zMax: band.zMax,
          zBase: band.zBase,
        },
        boundaryDisableAtZoomOrAbove: transformConfig.boundaryDisableAtZoomOrAbove,
        simplified: simplified as FeatureCollection,
        inputFeatureCount,
        inputPolygonCount,
        inputVertexCount,
        tolerance,
        geometryOps,
        taskProgressRange: {
          outputBuildStart: taskProgressRange.outputBuildStart,
          outputBuildEnd: taskProgressRange.outputBuildEnd,
          encodeStart: taskProgressRange.encodeStart,
          encodeEnd: taskProgressRange.encodeEnd,
          cachePutStart: taskProgressRange.cachePutStart,
        },
        abortSignal,
        updateTaskPhase: (
          outputTaskId,
          phase,
          progress,
          options,
        ) => (
          updateTaskPhase(outputTaskId, phase, progress, options)
        ),
        reportPolygonProgress,
        setStageLabel,
        logDebugPhase,
        setOutputCollection: (collection) => {
          outputCollection = collection;
        },
        assertNotAborted,
        updateTaskStrict,
        ephemeralDB,
      });
    } catch (error) {
      if (abortSignal?.aborted) {
        throw error;
      }
      const err = error instanceof Error ? error.message : String(error);
      const stagedError = err.startsWith('stage=') ? err : `stage=${stageLabel} ${err}`;
      logDebugPhase('task-error', { error: stagedError });
      const diagnostics = [
        buildCollectionDiagnostics(workingCollection, 'input', geometryOps),
        buildCollectionDiagnostics(simplified, 'simplified', geometryOps),
        buildCollectionDiagnostics(outputCollection, 'output', geometryOps),
      ].filter((value): value is string => Boolean(value)).join(' ');
      let progressUpdateError: string | null = null;
      try {
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
      } catch (progressError) {
        progressUpdateError = progressError instanceof Error ? progressError.message : String(progressError);
        console.error('[ShapeTransform] failed to update progress during error handling', {
          taskId: task.taskId,
          progressUpdateError,
        });
      }
      return {
        status: 'failed',
        errorMessage: `transform failed: ${stagedError}${diagnostics ? ` | diagnostics: ${diagnostics}` : ''}${progressUpdateError ? ` | progressUpdateError: ${progressUpdateError}` : ''}`,
      };
    } finally {
      if (debugHeartbeat) {
        clearInterval(debugHeartbeat);
      }
      logDebugPhase('task-end');
    }
  };
};
