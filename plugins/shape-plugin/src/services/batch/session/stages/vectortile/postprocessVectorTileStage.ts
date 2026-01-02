import type { GeometryStatsSummary } from './types.js';

export async function postprocessVectorTileStage(params: {
  persistPlaceholderMetadata: (replace: boolean) => Promise<number>;
  syncVectorTilesToShapeStore: () => Promise<void>;
  metadataEnabled: boolean;
  summarizeVectorTilesByOrigin: () => Promise<Map<string, GeometryStatsSummary>>;
  updateSourceMetadataStage: (stage: 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
  clearFeatureCache?: () => void;
}): Promise<void> {
  const {
    persistPlaceholderMetadata,
    syncVectorTilesToShapeStore,
    metadataEnabled,
    summarizeVectorTilesByOrigin,
    updateSourceMetadataStage,
    clearFeatureCache,
  } = params;

  await persistPlaceholderMetadata(false);
  await syncVectorTilesToShapeStore();

  if (metadataEnabled) {
    const statsByOrigin = await summarizeVectorTilesByOrigin();
    await updateSourceMetadataStage('vectorTile', statsByOrigin);
  }

  clearFeatureCache?.();
}
