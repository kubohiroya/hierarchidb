import type { Feature, FeatureCollection } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload } from '../../../../build-api';
import {
  applyFeatureFiltering,
  type EphemeralTransformCacheMetaRecord,
} from '@hierarchidb/gis-sdk';
import { DEFAULT_MAX_RATIO_VALUE, type ShapeGeometryErrorRecord } from '@hierarchidb/shape-api';
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
  findBaseToleranceByBisection,
  retrySimplifyFeatureWithinVertexLimit,
  selectMaxVertexFeature,
} from './transformByBandRetrySimplify.js';
import { resolveSimplifyToleranceProfile } from './helpers/simplifyProfile.js';

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  if (isTaskDebugLoggingEnabled()) {
    console.debug('[ShapeGeometry][TaskDebug] handler created', {
      tag: TASKDEBUG_BUILD_TAG,
      bandCount: context.bands.length,
      geometryEngine: context.geometryConfig.geometryEngine ?? 'turf',
    });
  }
  const {
    ephemeralDB,
    geometryConfig,
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
  const updateTaskRetryAttempt = async (taskId: string, retryAttempt: number): Promise<void> => {
    if (!Number.isFinite(retryAttempt) || retryAttempt < 0) return;
    try {
      const currentTask = await taskQueue.tasks.get(taskId);
      const currentMetadata = currentTask?.metadata;
      const baseMetadata = typeof currentMetadata === 'object' && currentMetadata !== null
        ? (currentMetadata as Record<string, unknown>)
        : {};
      await updateTaskStrict(taskId, {
        metadata: {
          ...baseMetadata,
          retryAttempt: Math.max(0, Math.floor(retryAttempt)),
        },
      }, 'metadata:update:retry-attempt');
    } catch (error) {
      console.warn('[ShapeGeometry] failed to update task retryAttempt', {
        taskId,
        retryAttempt,
        error,
      });
    }
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
    await updateTaskRetryAttempt(taskId, params.attempt);
  };
  // Feature filtering is intentionally disabled during geometry stage while investigating geometry distortion.
  const enableFeatureFiltering = false;
  const simplifyAlgorithm = resolveSimplifyAlgorithm(geometryConfig.simplifyAlgorithm);
  const geometryEngine = geometryConfig.geometryEngine ?? 'turf';
  const preserveTopology = geometryConfig.preserveTopology ?? true;
  const traceLogLevel = normalizeTraceLogLevel(geometryConfig.executionLogLevel);
  const intakeGuardConfig = {
    validationLevel: 'off' as const,
    dedupeEpsilon: 0,
    minRingAreaThreshold: 0,
    normalizeRingOrientation: false,
    keepBaselineSnapshot: false,
  } as const;
  if (geometryEngine !== 'turf') {
    throw new Error(`geometry failed: unknown geometryEngine (${String(geometryEngine)})`);
  }
  const geometryOps = createGeometryOps(geometryEngine);
  const bandMap = new Map(bands.map((band) => [band.bandIndex, band] as const));
  let debugTaskId: string | null = null;
  let debugTaskStartedAt: number | null = null;
  let debugNodeId: NodeId | null = null;
  let debugSelectionLogged = false;
  let firstTaskLogged = false;
  const MAX_TOLERANCE_SEARCH_ITERATIONS = 64;
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
  const buildTransformPreviewMetadata = (
    nodeId: NodeId,
    input: TransformByBandTaskInput | null,
  ): Record<string, unknown> | null => {
    if (!input) return null;
    const geometryCacheId = `${nodeId}-b${input.bandIndex}-${input.domainType}-${input.sourceKey}`;
    return {
      stage: 'geometry',
      sourceCacheId: input.sourceCacheId,
      sourceCacheFormat: input.sourceCacheFormat ?? 'flatgeobuf',
      sourceCacheCompression: input.sourceCacheCompression ?? 'none',
      geometryCacheId,
      sourceKey: input.sourceKey,
      bandIndex: input.bandIndex,
      dataSource: input.dataSource ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourceCountryCode: input.sourceCountryCode ?? input.countryCode ?? null,
      adminLevel: input.adminLevel ?? null,
    };
  };

  return async (task): Promise<StageHandlerResult> => {
    const taskId = task.taskId;
    let currentInputForMetadata: TransformByBandTaskInput | null = null;
    let retryAttemptForTask = 0;
    let finalEffectiveToleranceForTask = Number.NaN;
    let inputFeatureCount = 0;
    const formatToleranceForMessage = (value: number): string => {
      if (!Number.isFinite(value)) return '-';
      return `${Number.parseFloat(value.toFixed(6))}`;
    };
    let finalToleranceSummary: number | undefined;
    let baseToleranceSummary: number | undefined;
    let toleranceSearchIterationsSummary = 0;
    let toleranceSearchConvergedSummary = false;
    let toleranceMultiplierSummary: number | undefined;
    let toleranceMinRatioSummary: number | undefined;
    let toleranceMaxRatioSummary: number | undefined;
    let vertexLimitSummary: number | undefined;
    const toResultMetadata = (
      status: 'completed' | 'failed' | 'skipped',
      effectiveTolerance: number,
      extractionRatio: number,
      retryAttempt: number,
    ): { metadata: Record<string, unknown> } => {
      const metadata: Record<string, unknown> = {
        status: `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
      };
      const preview = buildTransformPreviewMetadata(task.nodeId, currentInputForMetadata);
      if (preview) {
        metadata.preview = preview;
      }
      if (Number.isFinite(effectiveTolerance)) {
        metadata.effectiveTolerance = effectiveTolerance;
      }
      if (Number.isFinite(baseToleranceSummary)) {
        metadata.baseTolerance = baseToleranceSummary;
      }
      if (Number.isFinite(toleranceSearchIterationsSummary)) {
        metadata.toleranceSearchIterations = toleranceSearchIterationsSummary;
      }
      metadata.toleranceSearchConverged = toleranceSearchConvergedSummary;
      if (Number.isFinite(toleranceMultiplierSummary)) {
        metadata.toleranceMultiplier = toleranceMultiplierSummary;
      }
      if (Number.isFinite(toleranceMinRatioSummary)) {
        metadata.toleranceMinRatio = toleranceMinRatioSummary;
      }
      if (Number.isFinite(toleranceMaxRatioSummary)) {
        metadata.toleranceMaxRatio = toleranceMaxRatioSummary;
      }
      if (Number.isFinite(vertexLimitSummary)) {
        metadata.vertexLimit = vertexLimitSummary;
      }
      if (Number.isFinite(retryAttempt) && retryAttempt >= 0) {
        metadata.retryAttempt = Math.max(0, Math.floor(retryAttempt));
      }
      if (Number.isFinite(extractionRatio)) {
        metadata.extractionRatio = extractionRatio;
      }
      return { metadata };
    };
    const resolveResultMetadata = (
      status: 'completed' | 'failed' | 'skipped',
      effectiveTolerance: number,
      extractionRatio = Number.NaN,
    ): ReturnType<typeof toResultMetadata> => (
      toResultMetadata(status, effectiveTolerance, extractionRatio, retryAttemptForTask)
    );
    const persistTransformCacheMetadata = async (
      status: 'completed' | 'failed' | 'skipped',
      metadata: Record<string, unknown>,
      extractionRatio = Number.NaN,
      counts?: {
        featureCount?: number;
        vertexCount?: number;
        polygonCount?: number;
      },
    ): Promise<void> => {
      if (!input) return;
      const cacheId = `${task.nodeId}-b${input.bandIndex}-${input.domainType}-${input.sourceKey}`;
      const record: EphemeralTransformCacheMetaRecord = {
        id: cacheId,
        nodeId: task.nodeId,
        domainType: input.domainType,
        bandIndex: input.bandIndex,
        sourceKey: input.sourceKey,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        featureCount: counts?.featureCount,
        vertexCount: counts?.vertexCount,
        polygonCount: counts?.polygonCount,
        extractionRatio: Number.isFinite(extractionRatio) ? extractionRatio : undefined,
        metadata: {
          ...metadata,
          status: (typeof metadata.status === 'string' && metadata.status.length > 0)
            ? metadata.status
            : `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
        },
        timestamp: Date.now(),
      };
      try {
        await ephemeralDB.geometryCacheMeta.put(record);
      } catch (error) {
        console.error('[ShapeGeometry] failed to persist geometryCacheMeta', {
          taskId,
          status,
          domainType: input.domainType,
          sourceKey: input.sourceKey,
          error,
        });
      }
    };
    const persistResultMetadata = async (
      status: 'completed' | 'failed' | 'skipped',
      extractionRatio = Number.NaN,
      counts?: {
        featureCount?: number;
        vertexCount?: number;
        polygonCount?: number;
      },
    ): Promise<ReturnType<typeof resolveResultMetadata>> => {
      const resultMetadata = resolveResultMetadata(status, finalEffectiveToleranceForTask, extractionRatio);
      await persistTransformCacheMetadata(status, resultMetadata.metadata, extractionRatio, counts);
      return resultMetadata;
    };
    const updateFinalEffectiveTolerance = (candidate: number): void => {
      if (!Number.isFinite(candidate)) return;
      if (!Number.isFinite(finalEffectiveToleranceForTask)) {
        finalEffectiveToleranceForTask = candidate;
        return;
      }
      finalEffectiveToleranceForTask = Math.max(finalEffectiveToleranceForTask, candidate);
    };
    void updateTaskRetryAttempt(taskId, 0);
    retryAttemptForTask = 0;
    if (!firstTaskLogged && isTaskDebugLoggingEnabled()) {
      firstTaskLogged = true;
      console.debug('[ShapeGeometry][TaskDebug] handler first task', {
        tag: TASKDEBUG_BUILD_TAG,
        nodeId: task.nodeId,
        taskId,
        stage: task.stage,
        inputKeys: Object.keys(task.inputData ?? {}),
      });
    }
    const input = task.inputData;
    currentInputForMetadata = input ?? null;
    if (!input) {
      const resultMetadata = resolveResultMetadata('failed', finalEffectiveToleranceForTask);
      return {
        status: 'failed',
        ...resultMetadata,
        errorMessage: 'geometry failed: task input is missing',
      };
    }
    const band = bandMap.get(input.bandIndex);
    if (!band) {
      const resultMetadata = await persistResultMetadata('failed');
      return {
        status: 'failed',
        ...resultMetadata,
        errorMessage: `geometry failed: unknown bandIndex (${input.bandIndex})`,
      };
    }
    const simplifyProfile = resolveSimplifyToleranceProfile(geometryConfig, input.adminLevel);
    if (!Array.isArray(simplifyProfile.multiplierByBand) || simplifyProfile.multiplierByBand.length === 0) {
      const resultMetadata = await persistResultMetadata('failed');
      return {
        status: 'failed',
        ...resultMetadata,
        errorMessage: 'geometry failed: tolerance multiplier profile is missing',
      };
    }
    const fallbackTolerance = 0.1;
    const toleranceSearchMaxIterations = simplifyProfile.toleranceSearchMaxIterations;
    const clampRatioValue = (value: number, fallback: number): number => {
      const candidate = Number.isFinite(value) ? value : fallback;
      return Math.max(0, Math.min(DEFAULT_MAX_RATIO_VALUE, candidate));
    };
    const rawMultiplier = resolveTransformTolerance(simplifyProfile.multiplierByBand, band.bandIndex, 1);
    const rawMinRatio = resolveTransformTolerance(simplifyProfile.minRatioByBand, band.bandIndex, 0);
    const rawMaxRatio = resolveTransformTolerance(simplifyProfile.maxRatioByBand, band.bandIndex, DEFAULT_MAX_RATIO_VALUE);
    const resolvedMinRatio = clampRatioValue(Math.min(rawMinRatio, rawMaxRatio), 0);
    const resolvedMaxRatio = clampRatioValue(Math.max(rawMinRatio, rawMaxRatio), DEFAULT_MAX_RATIO_VALUE);
    const resolvedMultiplier = clampRatioValue(rawMultiplier, 1);
    const resolveAppliedTolerance = (baseTolerance: number): number => {
      const candidate = baseTolerance * resolvedMultiplier;
      const minTolerance = baseTolerance * resolvedMinRatio;
      const maxTolerance = baseTolerance * resolvedMaxRatio;
      return Math.max(minTolerance, Math.min(maxTolerance, candidate));
    };
    let tolerance = fallbackTolerance;
    finalToleranceSummary = tolerance;
    updateFinalEffectiveTolerance(tolerance);
    const retryVertexLimit = resolveRetryVertexLimit(input.countryCode);
    vertexLimitSummary = retryVertexLimit;
    toleranceMultiplierSummary = resolvedMultiplier;
    toleranceMinRatioSummary = resolvedMinRatio;
    toleranceMaxRatioSummary = resolvedMaxRatio;
    emitTransformTrace(traceLogLevel, 'summary', 'task-config', {
      sessionId: String(task.nodeId),
      taskId,
      stage: 'geometry',
      simplifyAlgorithm,
      preserveTopology,
      fallbackTolerance,
      fetchIntakeGuard: intakeGuardConfig,
      toleranceMultiplier: resolvedMultiplier,
      toleranceMinRatio: resolvedMinRatio,
      toleranceMaxRatio: resolvedMaxRatio,
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
      console.debug('[ShapeGeometry][TaskDebug]', {
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
        console.debug('[ShapeGeometry][TaskDebug] selection', {
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
        sourceCacheId: input.sourceCacheId,
        domainType: input.domainType,
        tolerance,
      });
      debugHeartbeat = setInterval(() => {
        logDebugPhase('task-heartbeat');
      }, 5000);
    }

    try {
      stageLabel = 'source:cache';
      logDebugPhase('source-cache:start', { sourceCacheId: input.sourceCacheId });
      await updateTaskPhase(taskId, 'geometry:start', taskProgressRange.transformStart);
      await updateTaskPhase(taskId, 'source-cache:start', taskProgressRange.fetchStart);
      assertNotAborted(abortSignal);
      let fetchWaitTimer: ReturnType<typeof setInterval> | null = null;
      let fetchWaitStartedAt: number | null = null;
      if (isDebugTask) {
        fetchWaitStartedAt = Date.now();
        fetchWaitTimer = setInterval(() => {
          const elapsedMs = fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null;
          console.debug('[ShapeGeometry][TaskDebug] source-cache:waiting', {
            nodeId: task.nodeId,
            taskId,
            sourceCacheId: input.sourceCacheId,
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
      const sourceCache = await ephemeralDB.sourceCache.get(input.sourceCacheId);
      if (fetchWaitTimer) {
        clearInterval(fetchWaitTimer);
      }
      if (!sourceCache) {
        const metadataResult = await persistResultMetadata('failed');
        return {
          status: 'failed',
          ...metadataResult,
          errorMessage: 'geometry failed: source cache not found',
        };
      }
      const noOpBand0Topojson = input.bandIndex === 0 && band.zMin <= 2
        && sourceCache.format === 'topojson'
        && simplifyAlgorithm === 'topojson';
      if (noOpBand0Topojson) {
        const fallbackPolygonCount = (() => {
          if (typeof input.inputPolygonCount === 'number' && Number.isFinite(input.inputPolygonCount)) {
            return input.inputPolygonCount > 0 ? Math.round(input.inputPolygonCount) : 0;
          }
          const sourceCachePolygonCount = typeof sourceCache.polygonCount === 'number' && Number.isFinite(sourceCache.polygonCount)
            ? Math.round(sourceCache.polygonCount)
            : 0;
          return sourceCachePolygonCount > 0 ? sourceCachePolygonCount : 0;
        })();
        const resultMetadata = await persistResultMetadata('completed', 1, {
          featureCount: fallbackPolygonCount,
          polygonCount: fallbackPolygonCount,
        });
        return {
          status: 'completed',
          progress: 100,
          ...resultMetadata,
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
      logDebugPhase('source-cache:done', {
        format: sourceCache.format,
        compression: sourceCache.compression ?? null,
        byteLength: sourceCache.data.byteLength,
        elapsedMs: fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null,
      });
      await updateTaskPhase(taskId, 'source-cache:done', taskProgressRange.fetchEnd);

      stageLabel = 'decode';
      logDebugPhase('decode:start', {
        format: sourceCache.format,
        compression: sourceCache.compression ?? null,
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
        const skipDecodeTopojsonSimplify = sourceCache.format === 'topojson' && simplifyAlgorithm === 'topojson';
        collection = await runStageWithLabel('decode', () => decodeFetchCacheByFormat({
          buffer: sourceCache.data,
          format: sourceCache.format,
          compression: sourceCache.compression,
          zTarget: band.zMax,
          toleranceK: tolerance,
          quantize: geometryConfig.quantize,
          simplifyAlgorithm,
          skipSimplification: skipDecodeTopojsonSimplify,
        }));
      } finally {
        decodeProgressActive = false;
        clearInterval(decodeProgressTimer);
      }
      if (!collection || collection.features.length === 0) {
        const metadataResult = await persistResultMetadata('failed');
        return {
          status: 'failed',
          ...metadataResult,
          errorMessage: 'geometry failed: empty source cache',
        };
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
          console.warn('[ShapeGeometry] recycling allowlist ignored (missing __hdbFeatureId)', {
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
            const resultMetadata = await persistResultMetadata('completed');
            return {
              status: 'completed',
              progress: 100,
              display: {
                kind: 'skip',
                key: 'stage.taskSkip.noRecyclingFeatures',
                params: {},
              },
              ...resultMetadata,
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
      if (enableFeatureFiltering && geometryConfig.enableFeatureFiltering) {
        stageLabel = 'filter:featureFiltering';
        await updateTaskPhase(taskId, 'filtering:start', taskProgressRange.decodeEnd);
        assertNotAborted(abortSignal);
        const filtered = await runStageWithLabel('filter:featureFiltering', () => applyFeatureFiltering(
          workingCollection,
          {
            minArea: geometryConfig.featureAreaThreshold,
            featureFilterMethod: geometryConfig.featureFilterMethod,
            minVertexCountForAreaFilter: geometryConfig.minVertexCountForAreaFilter,
            hybridFilterConfig: geometryConfig.hybridFilterConfig,
          },
          geometryEngine,
        ));
        if (filtered && typeof filtered === 'object' && (filtered as FeatureCollection).type === 'FeatureCollection') {
          workingCollection = filtered as FeatureCollection;
        }
        const filterTarget = workingCollection;
        if (!filterTarget) {
          const metadataResult = await persistResultMetadata('failed');
          return {
            status: 'failed',
            ...metadataResult,
            errorMessage: 'geometry failed: empty working collection before filters',
          };
        }
        stageLabel = 'filter:aspectArea';
        const filteredFeatures = await runStageWithLabel('filter:aspectArea', () => filterFeaturesByAspectRatioAndArea(
          filterTarget.features,
          geometryConfig.aspectRatioThreshold,
          geometryConfig.areaThreshold,
          geometryOps,
        ));
        workingCollection = { ...filterTarget, features: filteredFeatures };
        await updateTaskPhase(taskId, 'filtering:done', taskProgressRange.decodeEnd);
      }

      assertNotAborted(abortSignal);
      const inputCollection = workingCollection;
      if (!inputCollection) {
        const metadataResult = await persistResultMetadata('failed');
        return {
          status: 'failed',
          ...metadataResult,
          errorMessage: 'geometry failed: empty working collection',
        };
      }
      inputFeatureCount = inputCollection.features.length;
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
        ?? readNonNegativeCount(sourceCache.polygonCount)
        ?? 0;
      inputVertexCount = readNonNegativeCount(input.inputVertexCount)
        ?? readNonNegativeCount(sourceCache.vertexCount)
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
        // Reserved for future: consume source-stage precomputed baseline metrics only.
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
        console.info('[ShapeGeometry][Admin0FeatureSample]', JSON.stringify({
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
      const representativeFeature = selectMaxVertexFeature(inputCollection, countVerticesFromGeometry);
      if (representativeFeature) {
        const runBaseSimplifyAttempt = async (nextTolerance: number): Promise<Feature | null> => {
          const retryCollection = await runStageWithLabel('simplify-only:base-search', () => (
            simplifyOnlyCollection(
              { type: 'FeatureCollection', features: [representativeFeature.feature] },
              band.zMax,
              nextTolerance,
              geometryOps,
            )
          ));
          const firstFeature = retryCollection.features[0];
          return firstFeature ?? null;
        };
        const baseSearch = await findBaseToleranceByBisection({
          feature: representativeFeature.feature,
          retryVertexLimit,
          maxIterations: toleranceSearchMaxIterations,
          initialLow: 0,
          initialHigh: Math.max(0.1, fallbackTolerance),
          highCap: 12,
          runSimplifyAttempt: runBaseSimplifyAttempt,
          countVerticesFromGeometry,
        });
        baseToleranceSummary = baseSearch.tolerance;
        toleranceSearchIterationsSummary = baseSearch.iterations;
        toleranceSearchConvergedSummary = baseSearch.converged;
        if (baseSearch.converged && Number.isFinite(baseSearch.tolerance)) {
          tolerance = resolveAppliedTolerance(baseSearch.tolerance);
        } else {
          tolerance = fallbackTolerance;
        }
        finalToleranceSummary = tolerance;
        updateFinalEffectiveTolerance(tolerance);
        console.info('[ShapeGeometry][Tolerance]', JSON.stringify({
          nodeId: task.nodeId,
          taskId,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          baseTolerance: baseToleranceSummary,
          appliedTolerance: tolerance,
          fallbackTolerance,
          multiplier: resolvedMultiplier,
          minRatio: resolvedMinRatio,
          maxRatio: resolvedMaxRatio,
          searchIterations: baseSearch.iterations,
          searchConverged: baseSearch.converged,
          representativeVertexCount: representativeFeature.vertexCount,
          representativeFeatureIndex: representativeFeature.featureIndex + 1,
          representativeFinalVertexCount: baseSearch.finalVertexCount,
        }));
      } else {
        tolerance = fallbackTolerance;
        finalToleranceSummary = tolerance;
        updateFinalEffectiveTolerance(tolerance);
      }
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
      const shouldDeferSimplifyToVt = sourceCache.format === 'topojson' && simplifyAlgorithm === 'topojson';
      const simplifyAttempt = 1;
      try {
        assertNotAborted(abortSignal);
        const simplifyStartAt = Date.now();
        stageLabel = 'simplify-only';
        logDebugPhase('simplify:start', {
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
        });
        console.log('[ShapeGeometry][SimplifyOnlyMetrics] start', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
          missingGeometry: inputMissingGeometry,
          algorithm: simplifyAlgorithm,
          sourceFormat: sourceCache.format,
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
            sourceFormat: sourceCache.format,
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
        console.log('[ShapeGeometry][SimplifyOnlyMetrics] done', {
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
          const errorRecords: ShapeGeometryErrorRecord[] = [];
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
              stage: 'geometry',
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
              await ephemeralDB.geometryErrors.bulkPut(errorRecords);
              if (inputCollection.features.length > errorRecords.length) {
                console.warn('[ShapeGeometry] empty simplify error records truncated', {
                  nodeId: task.nodeId,
                  taskId: task.taskId,
                  limit: recordLimit,
                  totalFeatures: inputCollection.features.length,
                });
              }
            } catch (storageError) {
              console.warn('[ShapeGeometry] failed to persist empty simplify error records', storageError);
            }
          }
          await reportPolygonProgress(task.taskId, inputPolygonCount, inputPolygonCount);
          const extractionRatio = inputFeatureCount > 0 ? inputCollection.features.length / inputFeatureCount : Number.NaN;
          const resultMetadata = await persistResultMetadata('completed', extractionRatio, {
            featureCount: inputCollection.features.length,
            polygonCount: inputCollection.features.length,
          });
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
            ...resultMetadata,
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
        const errorRecords: ShapeGeometryErrorRecord[] = [];
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
              stage: 'geometry',
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
            await ephemeralDB.geometryErrors.bulkPut(errorRecords);
          } catch (storageError) {
            console.warn('[ShapeGeometry] failed to persist geometry error details', storageError);
          }
        }
        const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
        const analysisNote = analysisErrors.length ? ` (analysisErrors=${analysisErrors.join(' | ')})` : '';
        const vertexLimitSnapshot = summarizeVertexLimit(simplified);
        const simplifySummary = vertexLimitSnapshot
          ? ` (finalVertexCount=${vertexLimitSnapshot.maxVertexCount}, overLimit=${vertexLimitSnapshot.overLimitFeatureCount}/${vertexLimitSnapshot.featureCount}, finalRetryAttempts=0, finalTolerance=${formatToleranceForMessage(tolerance)})`
          : ` (finalVertexCount=-, overLimit=-, finalRetryAttempts=0, finalTolerance=${formatToleranceForMessage(tolerance)})`;
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        const resultMetadata = await persistResultMetadata('failed');
        return {
          status: 'failed',
          ...resultMetadata,
          errorMessage: `geometry failed: geometry simplify error (extract1/${band.zMax}) (${err}) (invalidFeatures=${errorFeatureCount}/${inputFeatureCount}, invalidPolygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}, invalidGeometries=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)}) (simplifyAttempt=${simplifyAttempt})${simplifySummary}${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}${analysisNote}`,
        };
      }
      if (!shouldDeferSimplifyToVt) {
        await updateTaskPhase(taskId, 'vertex-limit-retry:start', taskProgressRange.simplifyEnd);
        const maxRetryAttempts = Math.max(1, Math.min(MAX_TOLERANCE_SEARCH_ITERATIONS, toleranceSearchMaxIterations));
        const maxToleranceForRetry = Math.max(tolerance + 1e-9, (baseToleranceSummary ?? tolerance) * resolvedMaxRatio);

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
                  maxRetryAttempts,
                  maxTolerance: maxToleranceForRetry,
                  minTolerance: tolerance,
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
            updateFinalEffectiveTolerance(result.finalTolerance);
            nextFeatures.push(result.feature);
            maxVertexCount = Math.max(maxVertexCount, result.vertexCount);
            if (result.overLimit) {
              overLimitFeatureCount += 1;
            }
            retryAttemptsTotal += result.retryAttempts;
            if (result.retryAttempts > 0) {
              await updateTaskRetryAttempt(taskId, retryAttemptsTotal);
              retryAttemptForTask = Math.max(retryAttemptForTask, Math.max(0, Math.floor(retryAttemptsTotal)));
            }
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
          console.info('[ShapeGeometry][SimplifyOnlyMetrics] repaired self-intersections after simplify', {
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
        const vertexLimitRecords: ShapeGeometryErrorRecord[] = [];
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
            stage: 'geometry',
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
            message: `max vertices per feature exceeded (vertexCount=${vertexCount} finalVertexCount=${finalVertexCount} limit=${retryVertexLimit} retryAttempts=${retryAttempts} finalTolerance=${formatToleranceForMessage(finalTolerance)})`,
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
          const finalTolerance = Number.isFinite(finalToleranceSummary) ? finalToleranceSummary : finalEffectiveToleranceForTask;
          const retrySummary = [
            `retryAttemptsTotal=${retryAttemptsTotal}`,
            `retriedFeatures=${retryAttemptedFeatureCount}/${simplifiedFeatureCountForLimit}`,
            `maxRetriesPerFeature=${maxRetryAttemptsPerFeature}`,
            `searchMaxIterations=${maxRetryAttempts}`,
            `finalToleranceRange=${formatToleranceForMessage(finalToleranceMinValue)}..${formatToleranceForMessage(finalToleranceMaxValue)}`,
          ].join(', ');
          if (vertexLimitRecords.length > 0) {
            try {
              await ephemeralDB.geometryErrors.bulkPut(vertexLimitRecords);
              if (overLimitFeatureCount > vertexRecordLimit) {
                console.warn('[ShapeGeometry] vertex limit error records truncated', {
                  nodeId: task.nodeId,
                  taskId: task.taskId,
                  limit: vertexRecordLimit,
                  totalFeatures: overLimitFeatureCount,
                });
              }
            } catch (storageError) {
              console.warn('[ShapeGeometry] failed to persist vertex limit error records', storageError);
            }
          }
          await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
          const simplifiedFeatureCountForCache = simplified.features.length;
          const simplifiedVertexCountForCache = simplified.features.reduce(
            (sum, feature) => sum + countVerticesFromGeometry(feature.geometry),
            0,
          );
          const simplifiedPolygonCountForCache = simplified.features.reduce(
            (sum, feature) => sum + countPolygonsFromGeometry(feature.geometry),
            0,
          );
          const resultMetadata = await persistResultMetadata(
            'failed',
            inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : Number.NaN,
            {
              featureCount: simplifiedFeatureCountForCache,
              vertexCount: simplifiedVertexCountForCache,
              polygonCount: simplifiedPolygonCountForCache,
            },
          );
          return {
            status: 'failed',
            ...resultMetadata,
            errorMessage: `geometry failed: max vertices per feature exceeded (limit=${retryVertexLimit}, overLimit=${overLimitFeatureCount}/${simplifiedFeatureCountForLimit}, maxVertices=${maxVertexCount}, finalVertexCount=${finalVertexCount}, finalRetryAttempts=${finalRetryAttempts}, finalTolerance=${formatToleranceForMessage(finalTolerance)}, ${retrySummary})`,
          };
        }
      }

      await updateTaskPhase(taskId, 'vertex-limit-validate:done', taskProgressRange.simplifyEnd);
      const outputResult = await runTransformByBandOutputPhase({
        taskId,
        nodeId: task.nodeId,
        input,
        band: {
          bandIndex: input.bandIndex,
          zMax: band.zMax,
          zBase: band.zBase,
        },
        boundaryDisableAtZoomOrAbove: geometryConfig.boundaryDisableAtZoomOrAbove,
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
        resultMetadata: resolveResultMetadata(
          'completed',
          finalEffectiveToleranceForTask,
          simplified?.features ? simplified.features.length / inputFeatureCount : Number.NaN,
        ).metadata,
        persistTransformCacheMetadata: (metadata) => persistTransformCacheMetadata(
          'completed',
          metadata,
          simplified?.features ? simplified.features.length / inputFeatureCount : Number.NaN,
          {
            featureCount: outputCollection?.features.length,
            vertexCount: (outputCollection?.features ?? []).reduce<number>(
              (sum, feature) => sum + countVerticesFromGeometry(feature.geometry),
              0,
            ),
            polygonCount: (outputCollection?.features ?? []).reduce<number>(
              (sum, feature) => sum + countPolygonsFromGeometry(feature.geometry),
              0,
            ),
          },
        ),
      });
      return {
        ...outputResult,
        ...resolveResultMetadata(
          'completed',
          finalEffectiveToleranceForTask,
          simplified?.features ? simplified.features.length / inputFeatureCount : Number.NaN,
        ),
      };
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
        console.error('[ShapeGeometry] failed to update progress during error handling', {
          taskId: task.taskId,
          progressUpdateError,
        });
      }
      const resultMetadata = await persistResultMetadata(
        'failed',
        inputFeatureCount > 0 ? (simplified?.features.length ?? 0) / inputFeatureCount : Number.NaN,
        {
          featureCount: ((outputCollection as FeatureCollection | null)?.features ?? []).length,
          vertexCount: ((outputCollection as FeatureCollection | null)?.features ?? []).reduce<number>(
            (sum, feature) => sum + countVerticesFromGeometry(feature.geometry),
            0,
          ),
          polygonCount: ((outputCollection as FeatureCollection | null)?.features ?? []).reduce<number>(
            (sum, feature) => sum + countPolygonsFromGeometry(feature.geometry),
            0,
          ),
        },
      );
      return {
        status: 'failed',
        ...resultMetadata,
        errorMessage: `geometry failed: ${stagedError}${diagnostics ? ` | diagnostics: ${diagnostics}` : ''}${progressUpdateError ? ` | progressUpdateError: ${progressUpdateError}` : ''}`,
      };
    } finally {
      if (debugHeartbeat) {
        clearInterval(debugHeartbeat);
      }
      logDebugPhase('task-end');
    }
  };
};
