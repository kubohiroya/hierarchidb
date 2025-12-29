import type { VectorTileWorkerAPI } from '../types.js';
import type { VectorTileProgress } from '@hierarchidb/gis-sdk';
import { DexieChunkStoragePort } from '@hierarchidb/download';

export type VectorTileStageInput = {
  bufferId: string;
  buffer?: ArrayBuffer;
  contentType?: string;
  config: {
    format: 'mvt' | 'pbf';
    compression?: 'gzip' | 'none';
    tileSize?: number;
    buffer?: number;
    minZoom?: number;
    maxZoom?: number;
    metadataEnabled?: boolean;
    metadataReplace?: boolean;
    metadataContext?: {
      dataSource?: string;
      countryCode?: string;
      countryName?: string;
      adminLevel?: number;
    };
    abortKey?: string;
  };
  onProgress?: (progress: VectorTileProgress) => void;
};

export type VectorTileStageResult = {
  generated: Awaited<ReturnType<VectorTileWorkerAPI['generateTiles']>>;
  tiles: Awaited<ReturnType<VectorTileWorkerAPI['listTiles']>>;
};

export type VectorTileStageOptions = {
  chunkStoreName?: string;
};

const DEFAULT_CHUNK_STORE = 'hidb-chunks';

export async function writeVectorTileInput(
  bufferId: string,
  buffer: ArrayBuffer,
  contentType = 'application/json',
  chunkStoreName = DEFAULT_CHUNK_STORE,
): Promise<void> {
  const storage = new DexieChunkStoragePort(chunkStoreName);
  await storage.putChunk(bufferId, 0, buffer);
  await storage.commit(bufferId, {
    sizeBytes: buffer.byteLength,
    contentType,
  });
}

export async function runVectorTileStage(
  input: VectorTileStageInput,
  client: VectorTileWorkerAPI,
  options: VectorTileStageOptions = {},
): Promise<VectorTileStageResult> {
  const { bufferId, buffer, contentType, config, onProgress } = input;
  if (buffer && !bufferId.startsWith('stage-tile:')) {
    await writeVectorTileInput(
      bufferId,
      buffer,
      contentType ?? 'application/json',
      options.chunkStoreName ?? DEFAULT_CHUNK_STORE,
    );
  }
  const generated = await client.generateTiles(bufferId, config, onProgress);
  const tiles = await client.listTiles(bufferId);
  return { generated, tiles };
}
