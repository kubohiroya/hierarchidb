import type { ShapeSourceMetadataRow } from '@hierarchidb/plugin-service-api';
import type { GeometryStatsSummary, OriginMetadata } from '../SessionTypes.js';

export function buildSourceMetadataBaseRows(params: {
  nodeKey: string;
  now: number;
  entries: OriginMetadata[];
  existingByOriginKey: Map<string, ShapeSourceMetadataRow>;
}): ShapeSourceMetadataRow[] {
  const { nodeKey, now, entries, existingByOriginKey } = params;
  return entries.map((entry) => {
    const prior = existingByOriginKey.get(entry.originKey);
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
}

export function buildSourceMetadataStageRows(params: {
  nodeKey: string;
  now: number;
  stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile';
  statsByOrigin: Map<string, GeometryStatsSummary>;
  existingByOriginKey: Map<string, ShapeSourceMetadataRow>;
  baseByOriginKey: Map<string, OriginMetadata>;
}): ShapeSourceMetadataRow[] {
  const { nodeKey, now, stage, statsByOrigin, existingByOriginKey, baseByOriginKey } = params;
  const rows: ShapeSourceMetadataRow[] = [];

  for (const [originKey, stats] of statsByOrigin.entries()) {
    const prior = existingByOriginKey.get(originKey);
    const base = baseByOriginKey.get(originKey);
    if (!prior && !base) continue;

    const dataSource = prior?.dataSource ?? base?.dataSource;
    if (!dataSource) continue;

    const bbox = (stage === 'raw' || stage === 'extract2')
      ? (stats.bbox ?? prior?.bbox)
      : prior?.bbox;

    rows.push({
      id: prior?.id ?? `${nodeKey}-${originKey}`,
      nodeId: nodeKey,
      originKey,
      originLabel: prior?.originLabel ?? base?.originLabel ?? originKey,
      dataSource,
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

  return rows;
}
