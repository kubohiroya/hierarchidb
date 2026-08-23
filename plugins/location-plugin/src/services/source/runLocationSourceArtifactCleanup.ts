import type { NodeId } from '@hierarchidb/core-types';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';

type VTStoreRegistryLike = {
  getVectorTiles?: <T extends VectorTileStore = VectorTileStore>(nodeType: string) => T | undefined;
};

type RuntimeWorkerModuleWithVTStoreRegistry = {
  getVTStoreRegistry?: () => VTStoreRegistryLike;
};

export const runLocationSourceArtifactCleanup = async (nodeId: NodeId): Promise<void> => {
  const registry = await resolveVTStoreRegistry();
  const vectorTileStore = registry?.getVectorTiles?.('location');
  if (!vectorTileStore) return;
  const existingTiles = await vectorTileStore.list(nodeId);
  if (existingTiles.length === 0) return;
  await vectorTileStore.bulkDelete(
    nodeId,
    existingTiles.map((tile) => tile.id)
  );
};

const resolveVTStoreRegistry = async (): Promise<VTStoreRegistryLike | undefined> => {
  const runtimeWorkerModule = (await import(
    '@hierarchidb/runtime-worker'
  )) as RuntimeWorkerModuleWithVTStoreRegistry;
  return runtimeWorkerModule.getVTStoreRegistry?.();
};
