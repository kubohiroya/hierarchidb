import type { NodeId } from '@hierarchidb/common-types';
import { BatchService, createLaneSemaphoreRegistry } from '@hierarchidb/batch';
import type { BoundingBox as TaskBoundingBox, DownloadTask } from '../../../common/types/index.js';
import type { ProgressInfo } from '../../../common/types/index.js';
import type { DownloadStageAdapter, DownloadStageAdapterResult } from './DownloadStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { defaultDataSourceFactory, type DataSourceStrategyId } from '../../datasources/DataSourceStrategyFactory.js';
import type { BoundingBox as DataSourceBoundingBox } from '../../datasources/DataSourceStrategy.js';
import type { FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

/**
 * RuntimeWorkerDownloadAdapter
 *
 * Scaffolds a runtime-worker-worker based download stage behind a stable adapter.
 * For now it leverages the shared DownloadService and keeps progress semantics.
 * Later this will dispatch tasks to @hierarchidb/runtime-worker-worker workers.
 */
export class RuntimeWorkerDownloadAdapter implements DownloadStageAdapter {
  private readonly laneRegistry = createLaneSemaphoreRegistry({
    defaults: {
      gadm: 2,
      osm: 1,
      naturalearth: 2,
      openmaptiles: 1,
      default: 4,
    },
    envKey: 'SHAPE_LANE_LIMITS',
    fallback: 4,
  });


  private resolveStrategyId(source?: string): DataSourceStrategyId | null {
    const key = (source ?? '').toLowerCase();
    if (key.includes('gadm')) return 'gadm-administrative-areas';
    if (key.includes('natural')) return 'natural-earth-shapes';
    if (key.includes('geo')) return 'geoboundaries-admin-areas';
    if (key.includes('osm') || key.includes('openstreet')) return 'openstreetmap-overpass';
    return null;
  }

  private normalizeBoundingBox(bbox?: TaskBoundingBox): DataSourceBoundingBox | undefined {
    if (!bbox || bbox.length !== 4) return undefined;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
    };
  }

  async process(
    sessionId: string,
    nodeId: NodeId,
    tasks: DownloadTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult> {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    console.debug('[ShapeDownloadAdapter] process', {
      sessionId,
      taskCount: tasks.length,
      dataSources: Array.from(new Set(tasks.map((task) => task.config?.dataSource ?? 'unknown'))),
    });
    const batch = new BatchService();
    const db = getEphemeralShapeDB();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    const recommendedConcurrency = this.laneRegistry.recommendConcurrency(
      tasks.map((task) => (task.config?.dataSource ?? 'default').toLowerCase()),
      4,
    );
    const maxConcurrent = controls?.maxConcurrent ?? recommendedConcurrency;

    await batch.mapChunks<DownloadTask, {}>(
      tasks,
      async (task: DownloadTask, index: number) => {
        const lane = (task.config?.dataSource ?? 'default').toLowerCase();
        await this.laneRegistry.runWithLane(lane, async () => {
          const fileId = `${sessionId}-download-${task.index ?? index}`;
          let finished = false;
          while (!finished) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
            }
            if (shouldAbort()) {
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
                continue;
              }
              return;
            }
            try {
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'running',
                  startedAt: Date.now(),
                  progress: 0,
                });
              }
              const strategyId = this.resolveStrategyId(task.config?.dataSource);
              if (!strategyId) throw new Error('No data source strategy available');
              const ds = defaultDataSourceFactory.create(strategyId);
              const retryAttempts = task.config?.retryAttempts ?? 0;
              const retryDelay = task.config?.retryDelay ?? 0;
              const timeoutMs = task.config?.timeoutMs;
              const bbox = this.normalizeBoundingBox(task.config?.bbox);
              const tags = task.config?.tags;
              let lastError: unknown;
              for (let attempt = 0; attempt <= retryAttempts; attempt++) {
                if (shouldAbort()) {
                  break;
                }
                try {
                  const signal = getSignal?.();
                  const raw = await ds.fetchData({
                    country: task.config?.country,
                    adminLevel: task.config?.adminLevel,
                    endpoint: task.config?.endpoint,
                    bbox,
                    tags,
                    timeout: timeoutMs,
                    signal,
                  });
                  const processed = await ds.processData(raw, { adminLevel: task.config?.adminLevel });
                  const featureCollection = {
                    type: 'FeatureCollection',
                    features: processed.map((entity) => ({
                      type: 'Feature',
                      geometry: entity.geometry ?? null,
                      properties: entity.properties ?? {},
                    })),
                  } as FeatureCollection;
                  const fgbBytes = await geojsonApi.serialize(featureCollection);
                  const fgb = fgbBytes.buffer.slice(fgbBytes.byteOffset, fgbBytes.byteOffset + fgbBytes.byteLength);
                  const bounds = turfBbox(featureCollection);
                  await db.rawBuffers.put({
                    id: fileId,
                    sessionId,
                    nodeId: task.nodeId ?? nodeId,
                    data: fgb,
                    featureCount: featureCollection.features.length,
                    bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
                    downloadTime: Date.now(),
                    size: fgb.byteLength,
                    timestamp: Date.now(),
                  });
                  totalBytes += fgb.byteLength;
                  completed += 1;
                  lastError = null;
                  break;
                } catch (error) {
                  if (shouldAbort() || isAbortError(error)) {
                    lastError = error;
                    break;
                  }
                  lastError = error;
                  if (attempt < retryAttempts && retryDelay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                  }
                }
              }
              if (shouldAbort() || isAbortError(lastError)) {
                if (controls?.waitIfPaused) {
                  await controls.waitIfPaused();
                  continue;
                }
                return;
              }
              if (lastError) {
                throw lastError;
              }
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                });
              }
              finished = true;
            } catch (error) {
              if (shouldAbort() || isAbortError(error)) {
                if (controls?.waitIfPaused) {
                  await controls.waitIfPaused();
                  continue;
                }
                return;
              }
              failed += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'failed',
                  completedAt: Date.now(),
                  progress: 100,
                  errorMessage: error instanceof Error ? error.message : 'Download failed',
                });
              }
              finished = true;
            }
          }
          if (shouldAbort()) {
            return;
          }
          onProgress({
            total: tasks.length,
            completed,
            failed,
            skipped: 0,
            percentage: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
            currentStage: 'download',
            currentTask: task.taskId,
          });
        });
      },
      { concurrency: Math.max(1, maxConcurrent) },
    );

    return { processed: completed, failed, totalDownloadSize: totalBytes };
  }
}
