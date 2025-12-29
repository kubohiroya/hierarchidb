import type { VectorTileWorkerAPI } from '../types.js';
import { DexieChunkStoragePort } from '@hierarchidb/download';

export type VectorTileStageInput = {
  inputBufferId: string;
  inputBuffer?: ArrayBuffer;
  contentType?: string;
  config: Parameters<VectorTileWorkerAPI['generateTiles']>[1];
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
  inputBufferId: string,
  buffer: ArrayBuffer,
  contentType = 'application/json',
  chunkStoreName = DEFAULT_CHUNK_STORE,
): Promise<void> {
  const storage = new DexieChunkStoragePort(chunkStoreName);
  await storage.putChunk(inputBufferId, 0, buffer);
  await storage.commit(inputBufferId, {
    sizeBytes: buffer.byteLength,
    contentType,
  });
}

export async function runVectorTileStage(
  input: VectorTileStageInput,
  client: VectorTileWorkerAPI,
  options: VectorTileStageOptions = {},
): Promise<VectorTileStageResult> {
  const { inputBufferId, inputBuffer, contentType, config } = input;
  if (inputBuffer && !inputBufferId.startsWith('stage-tile:')) {
    await writeVectorTileInput(
      inputBufferId,
      inputBuffer,
      contentType ?? 'application/json',
      options.chunkStoreName ?? DEFAULT_CHUNK_STORE,
    );
  }
  const generated = await client.generateTiles(inputBufferId, config);
  const tiles = await client.listTiles(inputBufferId);
  return { generated, tiles };
}
