import type { NodeId } from '@hierarchidb/common-types';
import type { GeometryStatsSummary, OriginMetadata } from '../SessionTypes.js';
import type { SessionArtifactStore } from '../../SessionArtifactStore.js';
import { updateSourceMetadataBase, updateSourceMetadataStage } from './sourceMetadata.js';

export type SourceMetadataStage = 'raw' | 'extract1' | 'extract2' | 'vectorTile';

export async function updateSourceMetadataBaseIfEnabled(params: {
  enabled: boolean;
  nodeId: NodeId;
  store: SessionArtifactStore;
  entries: OriginMetadata[];
}): Promise<void> {
  const { enabled, nodeId, store, entries } = params;
  if (!enabled) return;
  await updateSourceMetadataBase(nodeId, store, entries);
}

export async function updateSourceMetadataStageIfEnabled(params: {
  enabled: boolean;
  nodeId: NodeId;
  store: SessionArtifactStore;
  originByKey: Map<string, OriginMetadata>;
  stage: SourceMetadataStage;
  statsByOrigin: Map<string, GeometryStatsSummary>;
}): Promise<void> {
  const { enabled, nodeId, store, originByKey, stage, statsByOrigin } = params;
  if (!enabled) return;
  await updateSourceMetadataStage(nodeId, store, originByKey, stage, statsByOrigin);
}

