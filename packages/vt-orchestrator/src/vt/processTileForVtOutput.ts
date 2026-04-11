import type { Tile } from 'geojson-vt';
import { expandTileBBox, resolveTileBufferPx, tileToBBox } from './vtStageGeometryTileUtils.js';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import { packTileId } from '~/tiles/tileId';
import type { VtTileTaskContext } from './vtStageTaskOutputTypes.js';
import { encodeTileForVt, storeTileForVt } from './vtStageTaskOutputTileOpsUtils.js';
import { calculateInputTileStats, calculateOutputTileStats } from './vtStageTaskOutputHelpers.js';
import { recordEncodeStats, recordInputTileStats, recordOutputTileStats, recordStoreStats } from './vtStageTaskOutputStats.js';
import type { VtTileOutputAggregates } from './vtStageTaskOutputStats.js';
import type { VTStageContext } from '~/contextTypes';
import { type VtInputTileStats, type VtOutputTileStats } from './vtStageTaskOutputHelpers.js';

type TileLayerMap = Record<string, Tile>;

type VtTileProcessorInput = {
  z: number;
  x: number;
  y: number;
  layers: TileLayerMap;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  tileEmitConfig: VTStageContext['tileEmitConfig'];
  vtpbf: typeof import('@maplibre/vt-pbf');
  tileWriter: VTStageContext['tileWriter'];
  debugCollect: boolean;
  taskContext: VtTileTaskContext;
  bufferSetHash: string;
  totals: VtTileOutputAggregates;
};

export type VtTileProcessorResult = {
  inputStats: VtInputTileStats;
  outputStats: VtOutputTileStats;
};

export const processTileForVtOutput = async (
  input: VtTileProcessorInput,
): Promise<VtTileProcessorResult> => {
  const {
    z,
    x,
    y,
    layers,
    featureStats,
    bufferSizes,
    tileEmitConfig,
    vtpbf,
    tileWriter,
    debugCollect,
    taskContext,
    bufferSetHash,
    totals,
  } = input;
  const tileId = packTileId(x, y, z);
  const tileBBox = tileToBBox(z, x, y);
  const tileBuffer = resolveTileBufferPx(tileEmitConfig);
  const inputStats = calculateInputTileStats(
    featureStats,
    bufferSizes,
    expandTileBBox(tileBBox, tileBuffer, tileEmitConfig.extent),
  );
  const outputStats = calculateOutputTileStats(layers);

  recordInputTileStats(totals, inputStats);
  recordOutputTileStats(totals, outputStats);

  const { bytes, durationMs: encodeDurationMs } = encodeTileForVt({
    z,
    x,
    y,
    layers,
    inputStats,
    outputStats,
    taskContext,
    tileEmitConfig,
    vtpbf,
  });
  recordEncodeStats(totals, 1, bytes.byteLength, encodeDurationMs);

  const { durationMs: storeDurationMs } = await storeTileForVt({
    z,
    x,
    y,
    layers,
    inputStats,
    outputStats,
    taskContext,
    bytes,
    tileWriter,
    tileId,
    bufferSetHash,
    debugCollect,
  });
  recordStoreStats(totals, 1, bytes.byteLength, storeDurationMs);

  return {
    inputStats,
    outputStats,
  };
};
