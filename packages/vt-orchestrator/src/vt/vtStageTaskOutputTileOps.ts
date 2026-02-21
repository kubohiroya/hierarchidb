import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import {
  type VtInputTileStats,
  type VtOutputTileStats,
} from './vtStageTaskOutputHelpers.js';
import type { VtTileTaskContext } from './vtStageTaskOutputTypes.js';

type TileWriter = VTStageContext['tileWriter'];

type TileLayerMap = Record<string, Tile>;

type TileEncodeInput = {
  z: number;
  x: number;
  y: number;
  layers: TileLayerMap;
  inputStats: VtInputTileStats;
  outputStats: VtOutputTileStats;
  taskContext: VtTileTaskContext;
  vtConfig: VTStageContext['vtConfig'];
  vtpbf: typeof import('@maplibre/vt-pbf');
};

type TileStoreInput = Omit<TileEncodeInput, 'vtConfig' | 'vtpbf'> & {
  tileId: number;
  bytes: Uint8Array;
  tileWriter: TileWriter;
  bufferSetHash: string;
};

type TimedTileOperationResult = {
  durationMs: number;
  byteLength: number;
};

export const encodeTileForVt = ({
  z,
  x,
  y,
  layers,
  inputStats,
  outputStats,
  taskContext,
  vtConfig,
  vtpbf,
}: TileEncodeInput): { bytes: Uint8Array; durationMs: number } => {
  const encodeStartedAt = Date.now();
  try {
    const bytes = vtpbf.fromGeojsonVt(layers, {
      version: 2,
      extent: vtConfig.extent,
    }) as Uint8Array;
    return { bytes, durationMs: Date.now() - encodeStartedAt };
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
};

export const storeTileForVt = async ({
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
}: TileStoreInput & {
  debugCollect: boolean;
}): Promise<TimedTileOperationResult> => {
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
  try {
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
    return { byteLength: bytes.byteLength, durationMs: Date.now() - storeStartedAt };
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
};
