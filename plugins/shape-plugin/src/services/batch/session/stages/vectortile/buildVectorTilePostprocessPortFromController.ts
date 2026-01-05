import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTaskPayload } from '../../../../../common/types/index.js';
import type { GeometryStatsSummary } from '../../SessionTypes.js';
import type { GeometryStatsExtractor } from '../../metadata/featureMetadata.js';
import { persistPlaceholderMetadata, summarizeVectorTilesByOrigin } from '../../metadata/featureMetadata.js';
import { buildVectorTilePostprocessPort } from './buildVectorTilePostprocessPort.js';
import { buildVectorTilePostprocessStore } from './buildVectorTilePostprocessStore.js';
import { buildVectorTileSourceMetadataUpdater } from './buildVectorTileSourceMetadataUpdater.js';
import type { VectorTileStagePostprocessPort } from './orchestratorTypes.js';
import type { SessionArtifactStore } from '../../../SessionArtifactStore.js';

export function buildVectorTilePostprocessPortFromController(params: {
  enabled: boolean;
  nodeId: NodeId;
  downloadTaskPayloads: DownloadTaskPayload[];

  artifactStore: SessionArtifactStore;

  extractGeometryStats: GeometryStatsExtractor;

  updateSourceMetadataStage: (
    stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile',
    statsByOrigin: Map<string, GeometryStatsSummary>,
  ) => Promise<void>;

  clearFeatureCache?: () => void | Promise<void>;
}): VectorTileStagePostprocessPort {
  const {
    enabled,
    nodeId,
    downloadTaskPayloads,
    artifactStore,
    extractGeometryStats,
    updateSourceMetadataStage,
    clearFeatureCache,
  } = params;

  return buildVectorTilePostprocessPort({
    enabled,
    nodeId,
    downloadTaskPayloads,
    store: buildVectorTilePostprocessStore(artifactStore),
    persistPlaceholderMetadata,
    summarizeVectorTilesByOrigin,
    extractGeometryStats,
    updateVectorTileSourceMetadata: buildVectorTileSourceMetadataUpdater({
      updateSourceMetadataStage,
    }),
    clearFeatureCache,
  });
}
