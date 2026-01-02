import type { DataSourceName, DownloadTaskPayload } from '../../../../../common/types/index.js';
import type { NodeId } from '@hierarchidb/common-types';

import type { GeometryStatsSummary } from './types.js';
import type { VectorTileStagePostprocessPort } from './orchestratorTypes.js';

import type { FeatureMetadataStore, GeometryStatsExtractor } from '../../metadata/featureMetadata.js';
import type { VectorTileSourceMetadataUpdater } from './buildVectorTileSourceMetadataUpdater.js';

export function buildVectorTilePostprocessPort(params: {
  enabled: boolean;
  nodeId: NodeId;

  dataSourceFallback: DataSourceName;
  downloadTaskPayloads: DownloadTaskPayload[];

  store: FeatureMetadataStore & { syncVectorTilesToShapeStore: () => Promise<void> };

  persistPlaceholderMetadata: (params: {
    enabled: boolean;
    replace: boolean;
    nodeId: NodeId;
    dataSourceFallback: DataSourceName;
    downloadTaskPayloads: DownloadTaskPayload[];
    store: FeatureMetadataStore;
  }) => Promise<number>;

  summarizeVectorTilesByOrigin: (params: {
    nodeId: NodeId;
    store: FeatureMetadataStore;
    extractGeometryStats: GeometryStatsExtractor;
  }) => Promise<Map<string, GeometryStatsSummary>>;

  extractGeometryStats: GeometryStatsExtractor;
  updateVectorTileSourceMetadata: VectorTileSourceMetadataUpdater;

  clearFeatureCache?: () => void | Promise<void>;
}): VectorTileStagePostprocessPort {
  const {
    enabled,
    nodeId,
    dataSourceFallback,
    downloadTaskPayloads,
    store,
    persistPlaceholderMetadata,
    summarizeVectorTilesByOrigin,
    extractGeometryStats,
    updateVectorTileSourceMetadata,
    clearFeatureCache,
  } = params;

  return {
    persistPlaceholderMetadata: async (replace: boolean) => {
      return await persistPlaceholderMetadata({
        enabled,
        replace,
        nodeId,
        dataSourceFallback,
        downloadTaskPayloads,
        store,
      });
    },

    syncVectorTilesToShapeStore: () => store.syncVectorTilesToShapeStore(),

    summarizeVectorTilesByOrigin: async () => {
      return await summarizeVectorTilesByOrigin({
        nodeId,
        store,
        extractGeometryStats,
      });
    },

    updateSourceMetadataStage: async (_stage, statsByOrigin) => {
      // stage is fixed to 'vectorTile' by the updater.
      void _stage;
      await updateVectorTileSourceMetadata(statsByOrigin);
    },

    clearFeatureCache,
  };
}
