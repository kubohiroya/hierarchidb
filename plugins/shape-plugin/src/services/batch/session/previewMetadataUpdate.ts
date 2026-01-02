import type { NodeId } from '@hierarchidb/common-types';
import type { GeometryStatsSummary, OriginMetadata } from './SessionTypes.js';
import type { SessionArtifactStore } from '../SessionArtifactStore.js';
import { updateSourceMetadataStageIfEnabled } from './sourceMetadataFacade.js';

export type PreviewMetadataStage = 'raw' | 'extract1' | 'extract2' | 'vectorTile';

export async function updatePreviewMetadataStage(params: {
  enabled: boolean;
  nodeId: NodeId;
  store: SessionArtifactStore;
  originByKey: Map<string, OriginMetadata>;
  stage: PreviewMetadataStage;
  statsByOrigin: Map<string, GeometryStatsSummary>;
}): Promise<void> {
  const { enabled, nodeId, store, originByKey, stage, statsByOrigin } = params;
  await updateSourceMetadataStageIfEnabled({
    enabled,
    nodeId,
    store,
    originByKey,
    stage,
    statsByOrigin,
  });
}

/**
 * テスト用: update関数をDIできる薄いラッパ。
 */
export async function updatePreviewMetadataStageWith(params: {
  enabled: boolean;
  nodeId: NodeId;
  store: SessionArtifactStore;
  originByKey: Map<string, OriginMetadata>;
  stage: PreviewMetadataStage;
  statsByOrigin: Map<string, GeometryStatsSummary>;
  update: typeof updateSourceMetadataStageIfEnabled;
}): Promise<void> {
  const { enabled, nodeId, store, originByKey, stage, statsByOrigin, update } = params;
  await update({
    enabled,
    nodeId,
    store,
    originByKey,
    stage,
    statsByOrigin,
  });
}
