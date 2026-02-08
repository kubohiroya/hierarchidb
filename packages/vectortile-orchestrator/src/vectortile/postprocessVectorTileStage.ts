import type { GeometryStatsSummary } from './types.js';

export async function postprocessVectorTileStage(params: {
  persistPlaceholderMetadata: (replace: boolean) => Promise<number>;
  syncVectorTilesToShapeStore: () => Promise<void>;
  metadataEnabled: boolean;
  summarizeVectorTilesByOrigin: () => Promise<Map<string, GeometryStatsSummary>>;
  updateDataSourceMetadataStage: (stage: 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
  clearFeatureCache?: () => void;
}): Promise<void> {
  const {
    persistPlaceholderMetadata,
    syncVectorTilesToShapeStore,
    metadataEnabled,
    summarizeVectorTilesByOrigin,
    updateDataSourceMetadataStage,
    clearFeatureCache,
  } = params;

  await persistPlaceholderMetadata(false);
  await syncVectorTilesToShapeStore();

  if (metadataEnabled) {
    const statsByOrigin = await summarizeVectorTilesByOrigin();
    await updateDataSourceMetadataStage('vectorTile', statsByOrigin);
  }

  clearFeatureCache?.();
}

