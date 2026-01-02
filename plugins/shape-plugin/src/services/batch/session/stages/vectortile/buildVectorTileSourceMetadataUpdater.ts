import type { GeometryStatsSummary } from '../../SessionTypes.js';

export type VectorTileSourceMetadataUpdater = (statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;

export function buildVectorTileSourceMetadataUpdater(update: {
  updateSourceMetadataStage: (
    stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile',
    statsByOrigin: Map<string, GeometryStatsSummary>,
  ) => Promise<void>;
}): VectorTileSourceMetadataUpdater {
  return async (statsByOrigin) => {
    await update.updateSourceMetadataStage('vectorTile', statsByOrigin);
  };
}

