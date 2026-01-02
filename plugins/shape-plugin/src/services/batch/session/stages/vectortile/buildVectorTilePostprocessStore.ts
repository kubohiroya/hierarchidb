import type { SessionArtifactStore } from '../../../SessionArtifactStore.js';
import type { FeatureMetadataStore } from '../../metadata/featureMetadata.js';

import { buildVectorTileFeatureMetadataStore } from './buildVectorTileFeatureMetadataStore.js';

export type VectorTilePostprocessStore = FeatureMetadataStore & {
  syncVectorTilesToShapeStore: () => Promise<void>;
};

export function buildVectorTilePostprocessStore(artifactStore: SessionArtifactStore): VectorTilePostprocessStore {
  return {
    ...buildVectorTileFeatureMetadataStore(artifactStore),
    syncVectorTilesToShapeStore: () => artifactStore.syncVectorTilesToShapeStore(),
  };
}

