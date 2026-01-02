import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeSourceMetadataRow } from '@hierarchidb/plugin-service-api';
import type { SessionArtifactStore } from '../../SessionArtifactStore.js';
import type { GeometryStatsSummary, OriginMetadata } from '../SessionTypes.js';
import { buildSourceMetadataBaseRows, buildSourceMetadataStageRows } from './sourceMetadataRows.js';

export async function updateSourceMetadataBase(
  nodeId: NodeId,
  artifactStore: SessionArtifactStore,
  entries: OriginMetadata[],
): Promise<void> {
  const nodeKey = String(nodeId);
  const existing = await artifactStore.listSourceMetadata();
  const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
  const nextKeys = new Set(entries.map((entry) => entry.originKey));
  const staleIds = existing.filter((row) => !nextKeys.has(row.originKey)).map((row) => row.id);
  if (staleIds.length > 0) {
    await artifactStore.deleteSourceMetadataByIds(staleIds);
  }
  const now = Date.now();
  const rows: ShapeSourceMetadataRow[] = buildSourceMetadataBaseRows({
    nodeKey,
    now,
    entries,
    existingByOriginKey: existingByKey,
  });
  if (rows.length > 0) {
    await artifactStore.putSourceMetadata(rows);
  }
}

export async function updateSourceMetadataStage(
  nodeId: NodeId,
  artifactStore: SessionArtifactStore,
  originMetadataByKey: Map<string, OriginMetadata>,
  stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile',
  statsByOrigin: Map<string, GeometryStatsSummary>,
): Promise<void> {
  if (statsByOrigin.size === 0) return;
  const nodeKey = String(nodeId);
  const existing = await artifactStore.listSourceMetadata();
  const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
  const now = Date.now();
  const rows: ShapeSourceMetadataRow[] = buildSourceMetadataStageRows({
    nodeKey,
    now,
    stage,
    statsByOrigin,
    existingByOriginKey: existingByKey,
    baseByOriginKey: originMetadataByKey,
  });
  if (rows.length > 0) {
    await artifactStore.putSourceMetadata(rows);
  }
}
