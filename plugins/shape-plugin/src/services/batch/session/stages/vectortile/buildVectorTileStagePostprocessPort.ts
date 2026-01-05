import type { NodeId } from '@hierarchidb/common-types';
import type { Feature } from 'geojson';

import type { DownloadTaskPayload } from '../../../../../common/types/index.js';
import type { GeometryStatsSummary } from '../../SessionTypes.js';
import type { SessionArtifactStore } from '../../../SessionArtifactStore.js';

import { buildVectorTilePostprocessPortFromController } from './buildVectorTilePostprocessPortFromController.js';

export type VectorTileStagePostprocessDeps = {
  enabled: boolean;
  nodeId: NodeId;
  downloadTaskPayloads: DownloadTaskPayload[];
  artifactStore: SessionArtifactStore;
  extractGeometryStats: (feature: Feature) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  };
  updateSourceMetadataStage: (stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
  clearFeatureCache: () => void;
};

/**
 * SessionController 由来の依存を集約して port を作る（SessionController を thin にするための薄いラッパ）。
 */
export function buildVectorTileStagePostprocessPort(deps: VectorTileStagePostprocessDeps) {
  return buildVectorTilePostprocessPortFromController({
    enabled: deps.enabled,
    nodeId: deps.nodeId,
    downloadTaskPayloads: deps.downloadTaskPayloads,
    artifactStore: deps.artifactStore,
    extractGeometryStats: deps.extractGeometryStats,
    updateSourceMetadataStage: deps.updateSourceMetadataStage,
    clearFeatureCache: deps.clearFeatureCache,
  });
}
