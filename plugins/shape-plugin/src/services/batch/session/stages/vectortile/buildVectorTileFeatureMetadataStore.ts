import type { SessionArtifactStore } from '../../../SessionArtifactStore.js';
import type { FeatureMetadataStore } from '../../metadata/featureMetadata.js';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';

// SessionArtifactStore -> FeatureMetadataStore adapter.
// This removes repetitive mapping logic from SessionController.
export function buildVectorTileFeatureMetadataStore(store: SessionArtifactStore): FeatureMetadataStore {
  return {
    putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => store.putFeatureMetadata(rows),
    listFeatureMetadata: async () => {
      const rows = await store.listFeatureMetadata();
      return rows.map((row: ShapeFeatureMetadataRow) => ({ featureId: row.featureId }));
    },
    deleteFeatureMetadataByNode: () => store.deleteFeatureMetadataByNode(),
    listVectorTileRows: async () => {
      const rows = await store.listVectorTileRows();
      return rows.map((row) => ({
        data: row.data,
        x: row.x,
        y: row.y,
        z: row.z,
      }));
    },
  };
}
