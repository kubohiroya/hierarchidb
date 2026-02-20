import type { Tile } from 'geojson-vt';
import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import { VtTaskQueueDb } from '~/task/taskQueue';
import {
  buildBufferSetHash,
  type InputFeatureStats,
  expandTileBBox,
  tileToBBox,
} from './vtStageGeometry.js';
import { buildSkippedMessage, buildTileSummary } from './vtStageSummary.js';
import { packTileId, parentToChildRange } from '~/tiles/tileId';
import { assertNotAborted, getHeapSnapshot } from './vtStageCore.js';
import type { GeojsonVtIndex } from './vtStageTileIndex.js';
import {
  calculateInputTileStats,
  calculateOutputTileStats,
  collectLayersForTileFromIndexes,
} from './vtStageTaskOutputHelpers.js';
import { createTileProgressReporter } from './vtStageTaskOutputProgress.js';

type VtTileOutputContext = {
  context: VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
  };
  input: VtTaskInput;
  taskContext: {
    taskId: string;
    nodeId: string;
    bandIndex?: number;
    tileId: number;
    bufferCount: number;
  };
  parent: {
    z: number;
    x: number;
    y: number;
  };
  band: {
    zMin: number;
    zMax: number;
  };
  parentInputMetadata: Record<string, unknown>;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  totalTiles: number;
  adminFeatureSummary: string;
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null;
  indexes: Map<string, GeojsonVtIndex> | null;
  vtpbf: typeof import('@maplibre/vt-pbf');
  debugCollect: boolean;
};

export const writeVtTiles = async ({
  context,
  task,
  input,
  taskContext,
  parent,
  band,
  parentInputMetadata,
  featureStats,
  bufferSizes,
  tilesByZoom,
  totalTiles,
  adminFeatureSummary,
  aggregatedLayersByTileId,
  indexes,
  vtpbf,
  debugCollect,
}: VtTileOutputContext): Promise<StageHandlerResult> => {
  const { vtConfig, tileWriter, abortSignal } = context;
  const taskQueue = new VtTaskQueueDb();
  const bufferSetHash = buildBufferSetHash(input.bufferIds);
  let processedTiles = 0;
  let generatedTiles = 0;
  const reportTileProgress = createTileProgressReporter({
    taskQueue,
    fixedTaskInfo: {
      taskId: task.taskId,
      nodeId: task.nodeId,
    },
    totalTiles,
    parentInputMetadata,
  });
  await reportTileProgress({
    processedTiles,
    generatedTiles,
    force: true,
    message: `tiles 0/${totalTiles}`,
  });

  const tilingStartedAt = Date.now();
  const totalInputStats = {
    inputBytes: 0,
    featureCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
    vertexCount: 0,
  };
  const totalOutputStats = {
    featureCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
    vertexCount: 0,
  };
  const encodeStats = {
    tileCount: 0,
    bytes: 0,
    duration: 0,
  };
  const storeStats = {
    tileCount: 0,
    bytes: 0,
    duration: 0,
  };
  console.info('[vt] encode/store start', JSON.stringify({
    ...taskContext,
    totalTiles,
    bufferCount: input.bufferIds.length,
    heap: getHeapSnapshot(),
  }));
  for (let z = band.zMin; z <= band.zMax; z++) {
    assertNotAborted(abortSignal);
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    for (let x = xStart; x <= xEnd; x++) {
      assertNotAborted(abortSignal);
      for (let y = yStart; y <= yEnd; y++) {
        assertNotAborted(abortSignal);
        const tileId = packTileId(x, y, z);
        const layers = aggregatedLayersByTileId
          ? (aggregatedLayersByTileId.get(tileId) ?? null)
          : (indexes ? collectLayersForTileFromIndexes(indexes, z, x, y) : null);
        processedTiles += 1;
        if (!layers) {
          await reportTileProgress({
            processedTiles,
            generatedTiles,
            force: false,
          });
          continue;
        }
        const tileBBox = tileToBBox(z, x, y);
        const inputStats = calculateInputTileStats(
          featureStats,
          bufferSizes,
          expandTileBBox(tileBBox, vtConfig.bufferSize, vtConfig.extent),
        );
        const outputStats = calculateOutputTileStats(layers);
        totalInputStats.inputBytes += inputStats.inputBytes;
        totalInputStats.featureCount += inputStats.featureCount;
        totalInputStats.polygonCount += inputStats.polygonCount;
        totalInputStats.lineStringCount += inputStats.lineStringCount;
        totalInputStats.vertexCount += inputStats.vertexCount;
        totalOutputStats.featureCount += outputStats.featureCount;
        totalOutputStats.polygonCount += outputStats.polygonCount;
        totalOutputStats.lineStringCount += outputStats.lineStringCount;
        totalOutputStats.vertexCount += outputStats.vertexCount;
        let bytes: Uint8Array;
        try {
          const encodeStartedAt = Date.now();
          bytes = vtpbf.fromGeojsonVt(layers as unknown as Tile[], {
            version: 2,
            extent: vtConfig.extent,
          }) as Uint8Array;
          encodeStats.duration += Date.now() - encodeStartedAt;
          encodeStats.tileCount += 1;
          encodeStats.bytes += bytes.byteLength;
        } catch (error) {
          console.error('[vt] failed to encode tile', JSON.stringify({
            ...taskContext,
            stage: 'encode',
            z,
            x,
            y,
            inputStats,
            outputStats,
            layerCount: Object.keys(layers).length,
            error: error instanceof Error ? error.message : String(error),
          }));
          throw error;
        }
        try {
          const storeStartedAt = Date.now();
          if (debugCollect) {
            console.info('[vt][debug] tileWriter start', JSON.stringify({
              ...taskContext,
              tileId,
              z,
              x,
              y,
              byteLength: bytes.byteLength,
            }));
          }
          await tileWriter({
            tileId,
            z,
            x,
            y,
            bufferSetHash,
            data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
            layers,
          });
          if (debugCollect) {
            console.info('[vt][debug] tileWriter done', JSON.stringify({
              ...taskContext,
              tileId,
              durationMs: Date.now() - storeStartedAt,
            }));
          }
          storeStats.duration += Date.now() - storeStartedAt;
          storeStats.tileCount += 1;
          storeStats.bytes += bytes.byteLength;
        } catch (error) {
          console.error('[vt] tileWriter failed', JSON.stringify({
            ...taskContext,
            stage: 'tileWriter',
            z,
            x,
            y,
            tileId,
            bufferSetHash,
            inputStats,
            outputStats,
            byteLength: bytes.byteLength,
            error: error instanceof Error ? error.message : String(error),
          }));
          throw error;
        }
        generatedTiles += 1;
        const zoomCounts = tilesByZoom.get(z);
        if (zoomCounts) {
          zoomCounts.generated += 1;
        }
        const message = `tiles ${processedTiles}/${totalTiles} | tile z=${z} x=${x} y=${y} input(bytes=${inputStats.inputBytes}, features=${inputStats.featureCount}, polygons=${inputStats.polygonCount}, lines=${inputStats.lineStringCount}, vertices=${inputStats.vertexCount}) output(features=${outputStats.featureCount}, polygons=${outputStats.polygonCount}, lines=${outputStats.lineStringCount}, vertices=${outputStats.vertexCount})`;
        await reportTileProgress({
          processedTiles,
          generatedTiles,
          force: false,
          message,
        });
      }
    }
  }

  console.info('[vt] tiling done', JSON.stringify({
    ...taskContext,
    processedTiles,
    generatedTiles,
    totalTiles,
    inputTotals: totalInputStats,
    outputTotals: totalOutputStats,
    encodeStats,
    storeStats,
    duration: Date.now() - tilingStartedAt,
    heap: getHeapSnapshot(),
  }));
  const finalTileSummary = buildTileSummary(tilesByZoom);
  if (generatedTiles === 0) {
    console.warn('[vt] generated zero tiles', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      zRange: [band.zMin, band.zMax],
      totalTiles,
      processedTiles,
      bufferCount: input.bufferIds.length,
      adminFeatureSummary,
      tileSummary: finalTileSummary,
    }));
    await reportTileProgress({
      processedTiles,
      generatedTiles,
      force: true,
      message: buildSkippedMessage(adminFeatureSummary, finalTileSummary, 'no tiles'),
    });
  } else {
    const summaryMessage = `${adminFeatureSummary}, ${finalTileSummary}`;
    await reportTileProgress({
      processedTiles,
      generatedTiles,
      force: true,
      message: summaryMessage,
    });
  }
  console.info('[vt] output tile totals', JSON.stringify({
    ...taskContext,
    generatedTiles,
    outputTotals: totalOutputStats,
  }));
  console.info('[vt] task completed', JSON.stringify({
    ...taskContext,
    processedTiles,
    generatedTiles,
    totalTiles,
    outputTotals: totalOutputStats,
    tilingDuration: Date.now() - tilingStartedAt,
    heap: getHeapSnapshot(),
  }));
  return {
    status: 'completed',
    progress: 100,
    message: generatedTiles === 0
      ? buildSkippedMessage(adminFeatureSummary, finalTileSummary, 'no tiles')
      : `${adminFeatureSummary}, ${finalTileSummary}`,
    metadata: parentInputMetadata,
    outputData: {
      tilesGenerated: generatedTiles,
      totalTiles,
    },
  };
};
