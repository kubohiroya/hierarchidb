import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeSourceMetadataRow } from '@hierarchidb/plugin-service-api';
import type { SessionArtifactStore } from '../../SessionArtifactStore.js';
import type { GeometryStatsSummary, OriginMetadata } from '../SessionTypes.js';

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
  const rows: ShapeSourceMetadataRow[] = entries.map((entry) => {
    const prior = existingByKey.get(entry.originKey);
    return {
      id: prior?.id ?? `${nodeKey}-${entry.originKey}`,
      nodeId: nodeKey,
      originKey: entry.originKey,
      originLabel: entry.originLabel,
      dataSource: entry.dataSource,
      countryName: entry.countryName,
      countryCode: entry.countryCode,
      continent: entry.continent,
      adminLevel: entry.adminLevel,
      featureGroupId: entry.featureGroupId,
      featureLabel: entry.featureLabel,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      rawVertexCount: prior?.rawVertexCount,
      rawPolygonCount: prior?.rawPolygonCount,
      extract1VertexCount: prior?.extract1VertexCount,
      extract1PolygonCount: prior?.extract1PolygonCount,
      extract2VertexCount: prior?.extract2VertexCount,
      extract2PolygonCount: prior?.extract2PolygonCount,
      vectorTileVertexCount: prior?.vectorTileVertexCount,
      vectorTilePolygonCount: prior?.vectorTilePolygonCount,
      bbox: prior?.bbox,
    };
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
  const rows: ShapeSourceMetadataRow[] = [];
  for (const [originKey, stats] of statsByOrigin.entries()) {
    const prior = existingByKey.get(originKey);
    const base = originMetadataByKey.get(originKey);
    if (!prior && !base) continue;
    const bbox = (stage === 'raw' || stage === 'extract2')
      ? (stats.bbox ?? prior?.bbox)
      : prior?.bbox;
    rows.push({
      id: prior?.id ?? `${nodeKey}-${originKey}`,
      nodeId: nodeKey,
      originKey,
      originLabel: prior?.originLabel ?? base?.originLabel ?? originKey,
      dataSource: prior?.dataSource ?? base?.dataSource,
      countryName: prior?.countryName ?? base?.countryName,
      countryCode: prior?.countryCode ?? base?.countryCode,
      continent: prior?.continent ?? base?.continent,
      adminLevel: prior?.adminLevel ?? base?.adminLevel,
      featureGroupId: prior?.featureGroupId ?? base?.featureGroupId,
      featureLabel: prior?.featureLabel ?? base?.featureLabel,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      rawVertexCount: stage === 'raw' ? stats.vertexCount : prior?.rawVertexCount,
      rawPolygonCount: stage === 'raw' ? stats.polygonCount : prior?.rawPolygonCount,
      extract1VertexCount: stage === 'extract1' ? stats.vertexCount : prior?.extract1VertexCount,
      extract1PolygonCount: stage === 'extract1' ? stats.polygonCount : prior?.extract1PolygonCount,
      extract2VertexCount: stage === 'extract2' ? stats.vertexCount : prior?.extract2VertexCount,
      extract2PolygonCount: stage === 'extract2' ? stats.polygonCount : prior?.extract2PolygonCount,
      vectorTileVertexCount: stage === 'vectorTile' ? stats.vertexCount : prior?.vectorTileVertexCount,
      vectorTilePolygonCount: stage === 'vectorTile' ? stats.polygonCount : prior?.vectorTilePolygonCount,
      bbox,
    });
  }
  if (rows.length > 0) {
    await artifactStore.putSourceMetadata(rows);
  }
}

