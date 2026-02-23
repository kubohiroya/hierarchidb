import { AbstractBuildSession } from '@hierarchidb/build-runtime-services';
import type { BuildProgressEvent, TaskStatus } from '../../../../packages/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  RouteBuildConfig,
  RouteFeature,
  RouteGenerationConfig,
  RouteGenerationMethod,
} from '@hierarchidb/route-store';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { RouteGenerator } from '@hierarchidb/route-engine';
import type { RouteGenerationResult } from '@hierarchidb/route-engine';
import { getRouteDB } from '@hierarchidb/route-store';
import type { EphemeralFetchCacheRecord, EphemeralTransformErrorRecord, EphemeralTileIdToBufferRelation } from '@hierarchidb/gis-sdk';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { EphemeralFetchCacheMetaRecord } from '@hierarchidb/gis-sdk';
import { getStageProcessingClient, writeVectorTileInput } from '@hierarchidb/runtime-worker';
import { buildZoomBandRanges, normalizeZoomBandBoundaries, DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';
import type { TaskQueueRecord } from '../../../../packages/build-api';
import { runStageTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskStage } from '../../../../packages/build-api';
import { LocationResolver } from './LocationResolver.js';

export type RouteBuildTaskStage = 'location-resolution' | 'route-generation' | 'transform' | 'vt';

export type RouteBuildTask = {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
  stage: RouteBuildTaskStage;
  status: TaskStatus;
  index: number;
  routeData?: {
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    method?: RouteGenerationMethod;
    sourceKey?: string;
    methodOptions?: RouteGenerationConfig['options'];
    startName?: string;
    endName?: string;
  };
  error?: string;
};

export type RouteBuildTaskQueueInput = {
  routeStage: RouteBuildTaskStage;
  routeData?: RouteBuildTask['routeData'];
};

export type RouteBuildSessionDeps = {
  generator?: { generate: (points: [number, number][], config: RouteGenerationConfig) => Promise<unknown> };
  routeDB?: Awaited<ReturnType<typeof getRouteDB>>;
  locationResolver?: LocationResolver;
};

const DEFAULT_LANE_CAPS: Record<string, number> = {
  osm_route: 1,
  searode: 1,
  searoute: 3,
  direct: 64,
  great_circle: 64,
  custom: 8,
};

export class RouteBuildSession extends AbstractBuildSession<RouteBuildConfig> {
  private readonly tasks: RouteBuildTask[];
  private readonly tasksById: Map<string, RouteBuildTask>;
  private readonly generator: RouteBuildSessionDeps['generator'];
  private readonly routeDB: ReturnType<typeof getRouteDB>;
  private readonly locationResolver: LocationResolver;

  constructor(nodeId: NodeId, config: RouteBuildConfig, tasks: RouteBuildTask[], deps?: RouteBuildSessionDeps) {
    super(nodeId, config);
    this.tasks = tasks;
    this.tasksById = new Map(tasks.map((task) => [task.taskId, task]));
    this.generator = deps?.generator ?? new RouteGenerator();
    this.routeDB = deps?.routeDB ?? getRouteDB();
    this.locationResolver = deps?.locationResolver ?? new LocationResolver();
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');

    const total = this.tasks.length;
    let { completed, failed } = this.countTaskResults();
    this.updateProgress({ total, completed, failed }, 'idle');

    const resolveTaskFilter = (routeStage: RouteBuildTaskStage) =>
      (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => task.inputData?.routeStage === routeStage;

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'fetch',
      taskFilter: resolveTaskFilter('location-resolution'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>, _signal: AbortSignal) =>
        this.handleLocationResolutionTask(task, _signal),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>, signal?: AbortSignal) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'location-resolution');

    const globalMaxConcurrent = Math.max(1, this.config.routeGeneration?.maxConcurrent ?? 1);
    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'fetch',
      taskFilter: resolveTaskFilter('route-generation'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>, taskSignal: AbortSignal) =>
        this.handleRouteGenerationTask(task, taskSignal),
      maxConcurrent: this.config.routeGeneration?.parallel ? globalMaxConcurrent : 1,
      failureHandling: 'continue',
      lanePolicy: {
        enabled: true,
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.resolveRouteLane(task),
        maxConcurrentForLane: (_lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => {
          const override = this.config.laneCaps?.[(task.inputData?.routeData?.method ?? this.config.routeGeneration.method) as string as RouteGenerationMethod];
          return override ?? DEFAULT_LANE_CAPS[task.inputData?.routeData?.method ?? this.config.routeGeneration.method] ?? 1;
        },
      },
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>, signal?: AbortSignal) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'route-generation');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'transform',
      taskFilter: resolveTaskFilter('transform'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleTransformTask(task),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'transform');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'vt',
      taskFilter: resolveTaskFilter('vt'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleVectorTileTask(task),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'vt');

    if (failed > 0) {
      throw new Error('Route build completed with failures');
    }
  }

  protected onBuildProgressEvent(_event: BuildProgressEvent): void {
  }

  private async handleLocationResolutionTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
    signal: AbortSignal,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'location-resolution') {
      localTask.status = 'failed';
      const error = `Unexpected route task stage. expected=${localTask.stage}, actual=location-resolution`;
      localTask.error = error;
      this.updateProgressByStage('location-resolution');
      throw new Error(error);
    }

    localTask.status = 'running';
    localTask.error = undefined;

    try {
      const { startCoordinates, endCoordinates } = await this.resolveRouteCoordinates(localTask, signal);
      localTask.routeData = {
        ...localTask.routeData,
        startCoordinates,
        endCoordinates,
      };
      if (localTask.routeData?.startLocationId && startCoordinates && !localTask.routeData?.startName) {
        const name = await this.resolveLocationNameById(localTask.routeData.startLocationId, signal);
        localTask.routeData = { ...localTask.routeData, startName: name };
      }
      if (localTask.routeData?.endLocationId && endCoordinates && !localTask.routeData?.endName) {
        const name = await this.resolveLocationNameById(localTask.routeData.endLocationId, signal);
        localTask.routeData = { ...localTask.routeData, endName: name };
      }
      localTask.status = 'completed';
      this.updateProgressByStage('location-resolution');
      return { status: 'completed', progress: 100 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      localTask.status = 'failed';
      localTask.error = message;
      this.updateProgressByStage('location-resolution');
      throw error;
    }
  }

  private async handleRouteGenerationTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
    signal: AbortSignal,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }

    localTask.status = 'running';
    localTask.error = undefined;
    const method = localTask.routeData?.method ?? this.config.routeGeneration.method;
    const options = localTask.routeData?.methodOptions;
    const coordinates = await this.resolveRouteCoordinates(localTask, signal);
    const startCoordinates = coordinates.startCoordinates;
    const endCoordinates = coordinates.endCoordinates;

    if (!startCoordinates || !endCoordinates) {
      const message = 'Route build task missing coordinates';
      localTask.status = 'failed';
      localTask.error = message;
      this.updateProgressByStage(localTask.stage);
      throw new Error(message);
    }

    const sourceKey = this.buildSourceKey(localTask, startCoordinates, endCoordinates, method);
    const result = await this.runRouteTask([startCoordinates, endCoordinates], method, options, signal);
    const routeRecord = this.createRouteFeature(localTask, sourceKey, {
      startCoordinates,
      endCoordinates,
    }, method, result);
    const fetchRecord = this.createFetchCacheRecord(routeRecord, sourceKey, result.lineGeometry);

    await this.routeDB.open?.();
    await ephemeralDB.open?.();
    await this.routeDB.transaction('rw', this.routeDB.features, async () => {
      await this.routeDB.features.put(routeRecord);
    });
    const fetchMetaRecord: EphemeralFetchCacheMetaRecord = {
      ...(fetchRecord as EphemeralFetchCacheRecord),
    };
    delete (fetchMetaRecord as unknown as { data?: ArrayBuffer }).data;
    await ephemeralDB.transaction('rw', [ephemeralDB.fetchCache, ephemeralDB.fetchCacheMeta], async () => {
      await ephemeralDB.fetchCache.put(fetchRecord);
      await ephemeralDB.fetchCacheMeta.put(fetchMetaRecord);
    });

    localTask.routeData = {
      ...localTask.routeData,
      sourceKey,
      startCoordinates,
      endCoordinates,
    };

    localTask.status = 'completed';
    this.updateProgressByStage(localTask.stage);
    return {
      status: 'completed',
      progress: 100,
    };
  }

  private async handleTransformTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'transform') {
      localTask.status = 'failed';
      const message = `Unexpected route task stage. expected=${localTask.stage}, actual=transform`;
      localTask.error = message;
      this.updateProgressByStage('transform');
      throw new Error(message);
    }

    localTask.status = 'running';
    localTask.error = undefined;

    const now = Date.now();
    await this.routeDB.open?.();
    await ephemeralDB.open?.();

    const routeFeatures = await this.routeDB.features.where('nodeId').equals(this.nodeId).toArray() as RouteFeature[];
    const fetchMetaRecords = await ephemeralDB.fetchCacheMeta.where('nodeId').equals(this.nodeId).toArray();
    const boundaries = normalizeZoomBandBoundaries(
      this.config.transformConfig?.zoomBandBoundaries ?? DEFAULT_ZOOM_BAND_BOUNDARIES,
      Math.max(0, Number.isFinite(this.config.routeGeneration?.maxConcurrent) ? 1 : 1),
      24,
    );
    const ranges = buildZoomBandRanges(boundaries, boundaries[0] ?? 0, boundaries[boundaries.length - 1] ?? 24);

    const duplicatePolicy = this.config.validation?.checkDuplicateRoutes === true;
    const validateDistance = this.config.validation?.validateDistance === true;
    const maxDistanceMeters = validateDistance
      ? (Number(this.config.validation?.maxDistanceKm) > 0 ? Number(this.config.validation?.maxDistanceKm) * 1000 : Number.NaN)
      : Number.NaN;
    const minDistanceByBand = this.config.routeTransformConfig?.minDistanceMetersByBand ?? [0];
    const toleranceByBand = this.config.routeTransformConfig?.simplifyToleranceByBand ?? [0];
    const routeById = new Map<string, RouteFeature>(routeFeatures.map((line) => [String(line.id), line]));

    const rangesWithBandIndex = ranges.map((range, index) => ({
      bandIndex: index,
      zMin: range.min,
      zMax: index === ranges.length - 1 ? range.max : Math.max(range.min, range.max - 1),
      zBase: range.min,
    }));

    const transformRecords: Array<{
      id: string;
      nodeId: NodeId;
      domainType: 'route';
      bandIndex: number;
      sourceKey: string;
      data: ArrayBuffer;
      featureCount: number;
      vertexCount: number;
      polygonCount: number;
      extractionRatio: number;
      tolerance: number;
      timestamp: number;
    }> = [];
    const relationRecords: EphemeralTileIdToBufferRelation[] = [];
    const tileIndex = new Map<string, Set<string>>();
    const transformErrors: EphemeralTransformErrorRecord[] = [];
    let errorSequence = 0;
    const routeLineIdsToSkip = new Set<string>();

    if (duplicatePolicy) {
      const seen = new Set<string>();
      for (const line of routeFeatures) {
        const key = line.featureId ?? line.id;
        if (!seen.has(key)) {
          seen.add(key);
          continue;
        }
        routeLineIdsToSkip.add(String(line.id));
        transformErrors.push(buildRouteBuildErrorRecord({
          nodeId: this.nodeId,
          stage: 'transform',
          message: `Duplicate route skipped by feature key ${key}`,
          sourceKey: String(line.featureId ?? key),
          featureId: String(line.id),
          sequence: errorSequence,
        }));
        errorSequence += 1;
      }
    }

    const fetchCacheRecords: Array<typeof fetchMetaRecords[number]> = fetchMetaRecords as Array<typeof fetchMetaRecords[number]>;
    for (const meta of fetchCacheRecords) {
      const sourceKey = meta.sourceKey;
      const buffer = await ephemeralDB.fetchCache.get(meta.id);
      if (!buffer) {
        transformErrors.push(buildRouteBuildErrorRecord({
          nodeId: this.nodeId,
          stage: 'transform',
          message: 'Fetch cache payload is missing.',
          sourceKey,
          sequence: errorSequence,
        }));
        errorSequence += 1;
        continue;
      }
      const sourceFeature = decodeRouteFeatureCollection(buffer.data);
      if (!sourceFeature) {
        transformErrors.push(buildRouteBuildErrorRecord({
          nodeId: this.nodeId,
          stage: 'transform',
          message: 'Failed to decode fetch cache payload.',
          sourceKey,
          sequence: errorSequence,
        }));
        errorSequence += 1;
        continue;
      }
      const sourceLineId = sourceFeature.id;
      const lineId = sourceLineId ? String(sourceLineId) : sourceFeature.id;
      if (lineId && routeLineIdsToSkip.has(lineId)) {
        continue;
      }
      const original = sourceFeature.coordinates;
      const routeLine = sourceLineId ? routeById.get(sourceLineId) : undefined;
      const distanceRaw = Number.isFinite(sourceFeature.distanceMeters)
        ? sourceFeature.distanceMeters
        : Number(routeLine?.distance ?? estimateLineDistanceMeters(sourceFeature.coordinates));
      const routeDistance = Number(distanceRaw);
      if (validateDistance && Number.isFinite(maxDistanceMeters) && routeDistance > maxDistanceMeters) {
        transformErrors.push(buildRouteBuildErrorRecord({
          nodeId: this.nodeId,
          stage: 'transform',
          message: `Distance exceeds limit: ${routeDistance.toFixed(0)}m > ${maxDistanceMeters.toFixed(0)}m`,
          sourceKey,
          featureId: lineId,
          sequence: errorSequence,
        }));
        errorSequence += 1;
        continue;
      }

      for (const band of rangesWithBandIndex) {
        const minDistance = resolveBandValue(minDistanceByBand, band.bandIndex, 0);
        if (routeDistance < minDistance) {
          transformErrors.push(buildRouteBuildErrorRecord({
            nodeId: this.nodeId,
            stage: 'transform',
            message: `Dropped by minDistance rule: ${routeDistance.toFixed(0)}m < ${minDistance.toFixed(0)}m`,
            sourceKey,
            featureId: lineId,
            sequence: errorSequence,
          }));
          errorSequence += 1;
          continue;
        }

        const tolerance = resolveBandValue(toleranceByBand, band.bandIndex, 0);
        const simplified = simplifyLine(original, tolerance);
        if (simplified.length < 2) {
          transformErrors.push(buildRouteBuildErrorRecord({
            nodeId: this.nodeId,
            stage: 'transform',
            message: 'Simplification removed required route vertices.',
            sourceKey,
            featureId: lineId,
            sequence: errorSequence,
          }));
          errorSequence += 1;
          continue;
        }

        const recordId = `${String(this.nodeId)}:transform:${band.bandIndex}:${sourceKey}`;
        const payload = {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            id: sourceLineId,
            properties: {
              id: sourceLineId,
              sourceKey,
              routeMode: sourceFeature.routeMode,
              distance: routeDistance,
              startLocationId: sourceFeature.startLocationId,
              endLocationId: sourceFeature.endLocationId,
            },
            geometry: {
              type: 'LineString' as const,
              coordinates: simplified,
            },
          }],
        };
        const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
        transformRecords.push({
          id: recordId,
          nodeId: this.nodeId,
          domainType: 'route',
          bandIndex: band.bandIndex,
          sourceKey,
          data,
          featureCount: 1,
          vertexCount: simplified.length,
          polygonCount: 0,
          extractionRatio: Math.max(0, Math.min(1, simplified.length / Math.max(1, original.length))),
          tolerance,
          timestamp: now,
        });

        const tileIds = collectRouteTileIds(simplified, band.zBase);
        for (const tileId of tileIds) {
          relationRecords.push({
            id: `${String(this.nodeId)}:${band.bandIndex}:${tileId}:${recordId}`,
            nodeId: this.nodeId,
            domainType: 'route',
            bandIndex: band.bandIndex,
            tileId,
            bufferId: recordId,
            featureCount: 1,
            cacheTimestamp: now,
            createdAt: now,
          });
        }

        if (lineId) {
          for (let i = 0; i < simplified.length - 1; i += 1) {
            const start = simplified[i]!;
            const end = simplified[i + 1]!;
            for (let zoom = band.zMin; zoom <= band.zMax; zoom += 1) {
              const range = resolveTileRangeForSegment(start, end, zoom);
              for (let x = range.x1; x <= range.x2; x += 1) {
                for (let y = range.y1; y <= range.y2; y += 1) {
                  const key = buildTileKey(this.nodeId, zoom, x, y);
                  const next = tileIndex.get(key) ?? new Set<string>();
                  next.add(lineId);
                  tileIndex.set(key, next);
                }
              }
            }
          }
        }
      }
    }

    const tileIndexRecords = Array.from(tileIndex.entries()).map(([key, lineIds]) => {
      const [, zRaw, xRaw, yRaw] = key.split(':');
      const z = Number(zRaw);
      const x = Number(xRaw);
      const y = Number(yRaw);
      return {
        id: key,
        nodeId: this.nodeId,
        z,
        x,
        y,
        lineIds: Array.from(lineIds),
        updatedAt: now,
      };
    });

    await this.routeDB.transaction('rw', this.routeDB.vectorTiles, this.routeDB.tileIndex, async () => {
      await this.routeDB.tileIndex.where('nodeId').equals(this.nodeId).delete?.();
      if (tileIndexRecords.length > 0) {
        await this.routeDB.tileIndex.bulkPut?.(tileIndexRecords);
      }
    });

    await ephemeralDB.transaction('rw', [
      ephemeralDB.transformCache,
      ephemeralDB.transformCacheMeta,
      ephemeralDB.tileIdToBufferRelations,
      ephemeralDB.transformErrors,
    ], async () => {
      await ephemeralDB.transformCache.where('nodeId').equals(this.nodeId).delete();
      await ephemeralDB.transformCacheMeta.where('nodeId').equals(this.nodeId).delete();
      await ephemeralDB.tileIdToBufferRelations.where('nodeId').equals(this.nodeId).delete();
      await ephemeralDB.transformErrors.where('nodeId').equals(this.nodeId).delete();

      if (transformRecords.length > 0) {
        await ephemeralDB.transformCache.bulkPut(transformRecords);
      }
      if (relationRecords.length > 0) {
        await ephemeralDB.tileIdToBufferRelations.bulkPut(relationRecords);
      }
      if (transformErrors.length > 0) {
        await ephemeralDB.transformErrors.bulkPut(transformErrors);
      }
    });

    localTask.status = 'completed';
    this.updateProgressByStage('transform');
    return { status: 'completed', progress: 100 };
  }

  private async handleVectorTileTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'vt') {
      localTask.status = 'failed';
      const error = `Unexpected route task stage. expected=${localTask.stage}, actual=vt`;
      localTask.error = error;
      this.updateProgressByStage('vt');
      throw new Error(error);
    }

    localTask.status = 'running';
    localTask.error = undefined;

    await this.routeDB.open?.();
    await this.routeDB.vectorTiles.where('nodeId').equals(this.nodeId).delete?.();
    const boundaries = normalizeZoomBandBoundaries(
      this.config.transformConfig?.zoomBandBoundaries ?? DEFAULT_ZOOM_BAND_BOUNDARIES,
      Math.max(0, Number.isFinite(this.config.routeGeneration?.maxConcurrent) ? 1 : 1),
      24,
    );
    const ranges = buildZoomBandRanges(boundaries, boundaries[0] ?? 0, boundaries[boundaries.length - 1] ?? 24);
    const bands = ranges.map((range, index) => ({
      bandIndex: index,
      zMin: range.min,
      zMax: index === ranges.length - 1 ? range.max : Math.max(range.min, range.max - 1),
    }));

    const transformMetas = await ephemeralDB.transformCacheMeta.where('nodeId').equals(this.nodeId).toArray();

    const stageClient = await getStageProcessingClient();
    for (const band of bands) {
      const bandMetas = transformMetas.filter((meta) => meta.bandIndex === band.bandIndex);
      if (bandMetas.length === 0) continue;
      const buffers = await ephemeralDB.transformCache.bulkGet(bandMetas.map((meta) => meta.id));
      const features = buffers
        .flatMap((buffer) => (buffer ? decodeRouteFeaturesFromTransform(buffer.data) : []));
      if (features.length === 0) {
        continue;
      }

      const payload = {
        type: 'FeatureCollection' as const,
        features,
      };
      const encoded = new TextEncoder().encode(JSON.stringify(payload)).buffer;
      const bufferId = `${String(this.nodeId)}-route-vt-band-${band.bandIndex}`;
      await writeVectorTileInput(bufferId, encoded, {
        inputFormat: this.config.vtConfig?.inputFormat ?? 'geojson',
        inputCompression: this.config.vtConfig?.inputCompression ?? 'none',
        nodeId: this.nodeId,
        tileId: bufferId,
        chunkStoreName: 'hidb-chunks',
      });
      const resultCompression = this.config.vtConfig?.compression === 'bz' ? 'gzip' : this.config.vtConfig?.compression;
      await stageClient.vectortile.generateTiles(bufferId, {
        format: 'mvt',
        compression: resultCompression ?? 'none',
        minZoom: band.zMin,
        maxZoom: band.zMax,
        inputFormat: this.config.vtConfig?.inputFormat ?? 'geojson',
        inputCompression: this.config.vtConfig?.inputCompression ?? 'none',
        buffer: this.config.vtConfig?.bufferSize,
        targetNodeId: this.nodeId,
        targetNodeType: 'route',
      });
      await stageClient.vectortile.getSummary(this.nodeId, 'route');
    }

    localTask.status = 'completed';
    localTask.error = undefined;
    this.updateProgressByStage('vt');
    return {
      status: 'completed',
      progress: 100,
    };
  }

  private async resolveRouteCoordinates(
    task: RouteBuildTask,
    _signal?: AbortSignal,
  ): Promise<{ startCoordinates?: [number, number]; endCoordinates?: [number, number] }> {
    const current = task.routeData;
    let startCoordinates = current?.startCoordinates;
    let endCoordinates = current?.endCoordinates;

    if (!startCoordinates && current?.startLocationId) {
      const point = await this.resolveLocationCoordinates(current.startLocationId, _signal);
      if (point) {
        startCoordinates = point;
      }
    }

    if (!endCoordinates && current?.endLocationId) {
      const point = await this.resolveLocationCoordinates(current.endLocationId, _signal);
      if (point) {
        endCoordinates = point;
      }
    }

    if (!startCoordinates || !endCoordinates) {
      if (!this.config.locationResolution?.fallbackToCoordinates) {
        if (!startCoordinates && !current?.startLocationId) {
          throw new Error('Route build task missing start coordinate');
        }
        if (!endCoordinates && !current?.endLocationId) {
          throw new Error('Route build task missing end coordinate');
        }
      }
    }

    return { startCoordinates, endCoordinates };
  }

  private async resolveLocationCoordinates(
    locationId: NodeId,
    _signal?: AbortSignal,
  ): Promise<[number, number] | undefined> {
    const location = await this.locationResolver.getLocation(locationId);
    if (!location) return undefined;
    return [location.coordinates[0], location.coordinates[1]];
  }

  private async resolveLocationNameById(locationId: NodeId, _signal?: AbortSignal): Promise<string | undefined> {
    const location = await this.locationResolver.getLocation(locationId);
    return location?.name;
  }

  private buildSourceKey(
    task: RouteBuildTask,
    start: [number, number],
    end: [number, number],
    method: RouteGenerationMethod,
  ): string {
    const startId = task.routeData?.startLocationId
      ? String(task.routeData.startLocationId)
      : coordinateKey(start);
    const endId = task.routeData?.endLocationId
      ? String(task.routeData.endLocationId)
      : coordinateKey(end);
    return `${method}:${startId}:${endId}`;
  }

  private createRouteFeature(
    task: RouteBuildTask,
    sourceKey: string,
    coordinates: { startCoordinates: [number, number]; endCoordinates: [number, number] },
    method: RouteGenerationMethod,
    result: RouteGenerationResult,
  ): RouteFeature {
    const now = Date.now();
    const routeMode = resolveRouteMode(method);
    const startCoords = coordinates.startCoordinates;
    const endCoords = coordinates.endCoordinates;
    return {
      id: sourceKey as NodeId,
      nodeId: this.nodeId,
      type: 'route-line-string',
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: sourceKey,
      featureId: sourceKey,
      routeMode,
      startLocationId: task.routeData?.startLocationId,
      endLocationId: task.routeData?.endLocationId,
      startPoint: {
        locationId: task.routeData?.startLocationId,
        latitude: startCoords[1],
        longitude: startCoords[0],
        name: task.routeData?.startName,
      },
      endPoint: {
        locationId: task.routeData?.endLocationId,
        latitude: endCoords[1],
        longitude: endCoords[0],
        name: task.routeData?.endName,
      },
      waypoints: result.lineGeometry,
      distance: result.distance,
      speed: result.duration && result.distance ? result.distance / result.duration : undefined,
      metadata: {
        sourceKey,
        generationMethod: method,
      },
    };
  }

  private createFetchCacheRecord(
    routeFeature: RouteFeature,
    sourceKey: string,
    lineGeometry: [number, number][],
  ): EphemeralFetchCacheRecord {
    const payload = {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        id: String(routeFeature.id),
        properties: {
          id: String(routeFeature.id),
          sourceKey,
          routeMode: routeFeature.routeMode,
          distance: routeFeature.distance,
          startLocationId: routeFeature.startLocationId ?? '',
          endLocationId: routeFeature.endLocationId ?? '',
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: lineGeometry,
        },
      }],
    };
    const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
    const now = Date.now();
    return {
      id: `${String(this.nodeId)}:fetch:${sourceKey}`,
      nodeId: this.nodeId,
      domainType: 'route',
      sourceKey,
      countryCode: undefined,
      adminLevel: undefined,
      data,
      featureCount: 1,
      inputFeatureCount: 1,
      bbox: computeLineBbox(lineGeometry),
      downloadTime: 0,
      size: data.byteLength,
      vertexCount: lineGeometry.length,
      polygonCount: 0,
      inputVertexCount: lineGeometry.length,
      inputPolygonCount: 0,
      timestamp: now,
    };
  }

  private resolveRouteLane(task: TaskQueueRecord<RouteBuildTaskQueueInput>): string {
    const method = task.inputData?.routeData?.method ?? this.config.routeGeneration.method;
    return method;
  }

  private countTaskResults(): { completed: number; failed: number } {
    let completed = 0;
    let failed = 0;
    for (const task of this.tasks) {
      if (task.status === 'completed') {
        completed += 1;
      } else if (task.status === 'failed') {
        failed += 1;
      }
    }
    return { completed, failed };
  }

  private findTask(taskId: string): RouteBuildTask | undefined {
    return this.tasksById.get(taskId);
  }

  private updateProgressByStage(stage: RouteBuildTaskStage): void {
    const { completed, failed } = this.countTaskResults();
    this.updateProgress({ total: this.tasks.length, completed, failed }, stage);
  }

  private async runRouteTask(
    points: [number, number][],
    method: RouteGenerationMethod,
    options: RouteGenerationConfig['options'],
    signal: AbortSignal,
  ): Promise<RouteGenerationResult> {
    if (signal.aborted) throw abortError('Route build aborted');
    const config: RouteGenerationConfig = {
      method,
      options,
    };
    const generated = await this.generator?.generate(points, config);
    if (!generated) {
      throw new Error('Route generation returned empty result');
    }
    return generated as RouteGenerationResult;
  }
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

function coordinateKey(point: [number, number]): string {
  return `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
}

function resolveRouteMode(method: RouteGenerationMethod) {
  if (method === 'searoute') return ROUTE_MODES.WATERWAY;
  if (method === 'osm_route') return ROUTE_MODES.ROAD;
  if (method === 'great_circle') return ROUTE_MODES.HIGHWAY;
  return ROUTE_MODES.ROAD;
}

const resolveBandValue = (values: number[] | undefined, bandIndex: number, fallback: number): number => {
  if (!values || values.length === 0) return fallback;
  const raw = values[Math.min(values.length - 1, Math.max(0, bandIndex))];
  return Number.isFinite(raw) ? Number(raw) : fallback;
};

const simplifyLine = (coords: [number, number][], tolerance: number): [number, number][] => {
  if (coords.length <= 2) return coords;
  if (!Number.isFinite(tolerance) || tolerance <= 0) return coords;
  const kept = douglasPeucker(coords, tolerance);
  if (kept.length < 2) return coords;
  return kept;
};

const douglasPeucker = (coords: [number, number][], tolerance: number): [number, number][] => {
  const squaredTolerance = tolerance * tolerance;
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = true;
  keep[coords.length - 1] = true;

  const simplifySegment = (startIndex: number, endIndex: number): void => {
    if (endIndex - startIndex <= 1) return;
    let maxDistance = 0;
    let index = -1;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = pointSegmentDistanceSquared(coords[i]!, coords[startIndex]!, coords[endIndex]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index > -1 && maxDistance > squaredTolerance) {
      keep[index] = true;
      simplifySegment(startIndex, index);
      simplifySegment(index, endIndex);
    }
  };

  simplifySegment(0, coords.length - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < coords.length; i += 1) {
    if (keep[i]) result.push(coords[i]!);
  }
  return result;
};

const pointSegmentDistanceSquared = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    const deltaX = point[0] - start[0];
    const deltaY = point[1] - start[1];
    return deltaX * deltaX + deltaY * deltaY;
  }
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  const projectedX = start[0] + t * dx;
  const projectedY = start[1] + t * dy;
  const deltaX = point[0] - projectedX;
  const deltaY = point[1] - projectedY;
  return deltaX * deltaX + deltaY * deltaY;
};

const computeLineBbox = (coordinates: [number, number][]): [number, number, number, number] => {
  if (coordinates.length === 0) return [0, 0, 0, 0];
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of coordinates) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
};

const estimateLineDistanceMeters = (coordinates: [number, number][]): number => {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [startLon, startLat] = coordinates[i] as [number, number];
    const [endLon, endLat] = coordinates[i + 1] as [number, number];
    total += haversineMeters(startLat, startLon, endLat, endLon);
  }
  return total;
};

const decodeRouteFeatureCollection = (buffer: ArrayBuffer): DecodedRouteFeature | null => {
  try {
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer))) as {
      features?: Array<{
        id?: string | number;
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: unknown };
      }>;
    };
    const feature = Array.isArray(json.features) ? json.features[0] : undefined;
    if (!feature || feature.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) return null;
    const coordinates = feature.geometry.coordinates
      .map((point) => (Array.isArray(point) && point.length >= 2
        ? [Number(point[0]), Number(point[1])] as [number, number]
        : null))
      .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
    if (coordinates.length < 2) return null;
    const props = feature.properties ?? {};
    return {
      id: feature.id != null ? String(feature.id) : undefined,
      sourceKey: typeof props.sourceKey === 'string' ? props.sourceKey : '',
      routeMode: typeof props.routeMode === 'string' ? props.routeMode : undefined,
      distanceMeters: typeof props.distance === 'number' ? props.distance : undefined,
      startLocationId: typeof props.startLocationId === 'string' ? props.startLocationId : undefined,
      endLocationId: typeof props.endLocationId === 'string' ? props.endLocationId : undefined,
      coordinates,
    };
  } catch {
    return null;
  }
};

const decodeRouteFeaturesFromTransform = (buffer: ArrayBuffer) => {
  const decoded = decodeRouteFeatureCollection(buffer);
  if (!decoded) return [];
  return [{
    type: 'Feature' as const,
    id: decoded.id,
    properties: {
      id: decoded.id,
      sourceKey: decoded.sourceKey,
      routeMode: decoded.routeMode,
      distance: decoded.distanceMeters,
      startLocationId: decoded.startLocationId,
      endLocationId: decoded.endLocationId,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: decoded.coordinates,
    },
  }];
};

const collectRouteTileIds = (coordinates: [number, number][], zBase: number): string[] => {
  const ids = new Set<string>();
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const start = coordinates[i]!;
    const end = coordinates[i + 1]!;
    const range = resolveTileRangeForSegment(start, end, zBase);
    for (let x = range.x1; x <= range.x2; x += 1) {
      for (let y = range.y1; y <= range.y2; y += 1) {
        ids.add(`${zBase}/${x}/${y}`);
      }
    }
  }
  return Array.from(ids);
};

const resolveTileRangeForSegment = (
  start: [number, number],
  end: [number, number],
  z: number
): { x1: number; x2: number; y1: number; y2: number } => {
  const minLon = Math.min(start[0], end[0]);
  const maxLon = Math.max(start[0], end[0]);
  const minLat = Math.min(start[1], end[1]);
  const maxLat = Math.max(start[1], end[1]);
  const maxIndex = 2 ** z - 1;
  const x1 = clampTileIndex(lonToTileX(minLon, z), maxIndex);
  const x2 = clampTileIndex(lonToTileX(maxLon, z), maxIndex);
  const y1 = clampTileIndex(latToTileY(maxLat, z), maxIndex);
  const y2 = clampTileIndex(latToTileY(minLat, z), maxIndex);
  return {
    x1: Math.min(x1, x2),
    x2: Math.max(x1, x2),
    y1: Math.min(y1, y2),
    y2: Math.max(y1, y2),
  };
};

const lonToTileX = (lon: number, z: number): number => {
  const scale = 2 ** z;
  return Math.floor(((lon + 180) / 360) * scale);
};

const latToTileY = (lat: number, z: number): number => {
  const scale = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale);
};

const clampTileIndex = (value: number, maxIndex: number): number => Math.min(maxIndex, Math.max(0, value));

const buildTileKey = (nodeId: NodeId, z: number, x: number, y: number): string => `${String(nodeId)}:${z}:${x}:${y}`;

const buildRouteBuildErrorRecord = (params: {
  nodeId: NodeId;
  stage: 'fetch' | 'transform' | 'vt';
  message: string;
  sourceKey?: string;
  featureId?: string;
  sequence: number;
}) => ({
  id: `${String(params.nodeId)}:route-error:${params.stage}:${params.sequence}`,
  nodeId: params.nodeId,
  domainType: 'route' as const,
  taskId: `${String(params.nodeId)}:${params.stage}`,
  stage: params.stage,
  issueStage: params.stage,
  issueKind: 'route-build',
  sourceKey: params.sourceKey,
  featureId: params.featureId,
  polygonCount: 0,
  ringCount: 0,
  polygonErrorCount: 0,
  ringErrorCount: 0,
  message: params.message,
  createdAt: Date.now(),
  lineFeatures: {
    type: 'FeatureCollection' as const,
    features: [],
  },
});

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type DecodedRouteFeature = {
  id?: string;
  sourceKey: string;
  routeMode?: string;
  distanceMeters?: number;
  startLocationId?: string;
  endLocationId?: string;
  coordinates: [number, number][];
};
