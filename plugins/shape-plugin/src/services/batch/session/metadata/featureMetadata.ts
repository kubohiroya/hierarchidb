import type { NodeId } from '@hierarchidb/common-types';
import type { Feature } from 'geojson';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import type { DownloadTaskPayload } from '../../../../common/types/index.js';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';
import { HDB_ORIGIN_KEY } from '../../utils/featureIds.js';
import type { GeometryStatsSummary } from '../SessionTypes.js';

export type FeatureMetadataPickers = {
  pickCountryName: (properties: Record<string, unknown>) => string | undefined;
  pickCountryCode: (properties: Record<string, unknown>) => string | undefined;
  pickAdminName: (properties: Record<string, unknown>) => string | undefined;
  pickAdminCode: (properties: Record<string, unknown>) => string | undefined;
  pickAdminLevel: (properties: Record<string, unknown>) => number | undefined;
  pickFirstString: (properties: Record<string, unknown>, keys: string[]) => string | undefined;
};

export type FeatureIdBuilder = (
  base: string,
  index: number,
  countryCode?: string,
  adminLevel?: number,
  adminCode?: string,
) => string;

export type GeometryStatsExtractor = (feature: Feature) => {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
};

export type DataSourceResolver = () => string;

export type FeatureMetadataStore = {
  putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => Promise<void>;
  listFeatureMetadata: () => Promise<Array<{ featureId: string }>>;
  deleteFeatureMetadataByNode: () => Promise<void>;
  listVectorTileRows: () => Promise<Array<{ data: ArrayBuffer; x: number; y: number; z: number }>>;
};

export function buildFeatureMetadataRecords(params: {
  nodeId: NodeId;
  dataSource: string;
  createdAt: number;
  features: Feature[];
  defaultCountryCode?: string;
  defaultAdminLevel?: number;
  pickers: FeatureMetadataPickers;
  buildFeatureId: FeatureIdBuilder;
  extractGeometryStats: GeometryStatsExtractor;
}): ShapeFeatureMetadataRow[] {
  const {
    nodeId,
    dataSource,
    createdAt,
    features,
    defaultCountryCode,
    defaultAdminLevel,
    pickers,
    buildFeatureId,
    extractGeometryStats,
  } = params;

  const rows: ShapeFeatureMetadataRow[] = [];
  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    if (!feature) continue;
    feature.properties ??= {};
    const properties = feature.properties as Record<string, unknown>;
    const stats = extractGeometryStats(feature);

    const countryCode = defaultCountryCode ?? pickers.pickCountryCode(properties);
    const adminLevel = defaultAdminLevel ?? pickers.pickAdminLevel(properties);
    const adminCode = pickers.pickAdminCode(properties);

    const precomputedId = pickers.pickFirstString(properties, ['__hdbFeatureId', 'hdbFeatureId']);
    const baseId = String(properties.id ?? feature.id ?? `feature-${index}`);
    const featureId = precomputedId ?? buildFeatureId(baseId, index, countryCode, adminLevel, adminCode);

    // side-effect: keep id stable downstream
    properties.id = featureId;

    rows.push({
      id: `${String(nodeId)}-${featureId}`,
      nodeId: String(nodeId),
      featureId,
      countryName: pickers.pickCountryName(properties),
      countryCode,
      adminName: pickers.pickAdminName(properties),
      adminLevel,
      adminCode,
      dataSource,
      createdAt,
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      bbox: stats.bbox,
      area: stats.area,
    });
  }
  return rows;
}

export async function persistPlaceholderMetadata(params: {
  enabled: boolean;
  replace: boolean;
  nodeId: NodeId;
  dataSourceFallback: string;
  downloadTaskPayloads: DownloadTaskPayload[];
  store: FeatureMetadataStore;
}): Promise<number> {
  const { enabled, replace, nodeId, dataSourceFallback, downloadTaskPayloads, store } = params;
  if (!enabled) return 0;

  const nodeKey = String(nodeId);
  if (replace) {
    await store.deleteFeatureMetadataByNode();
  }

  const existing = replace
    ? new Set<string>()
    : new Set((await store.listFeatureMetadata()).map((row) => row.featureId));

  const createdAt = Date.now();
  const rows: ShapeFeatureMetadataRow[] = [];

  for (const payload of downloadTaskPayloads) {
    const dataSource = payload.dataSource ?? dataSourceFallback;
    const countryCode = (payload.countryCode ?? 'UNK').trim().toUpperCase();
    const adminLevel = payload.adminLevel;
    const featureKey = `${dataSource ?? 'unknown'}:${countryCode}:${adminLevel ?? 'NA'}`;
    if (existing.has(featureKey)) continue;
    existing.add(featureKey);
    rows.push({
      id: `${nodeKey}-${featureKey}`,
      nodeId: nodeKey,
      featureId: featureKey,
      countryName: payload.countryName,
      countryCode,
      adminLevel,
      dataSource,
      createdAt,
      vertexCount: 0,
      polygonCount: 0,
      area: 0,
    });
  }

  if (rows.length > 0) {
    await store.putFeatureMetadata(rows);
  }

  return rows.length;
}

export async function summarizeVectorTilesByOrigin(params: {
  nodeId: NodeId;
  store: FeatureMetadataStore;
  extractGeometryStats: GeometryStatsExtractor;
}): Promise<Map<string, GeometryStatsSummary>> {
  const { nodeId, store, extractGeometryStats } = params;

  const statsByOrigin = new Map<string, GeometryStatsSummary>();
  let totalFeatures = 0;
  let missingOriginKey = 0;

  const rows = await store.listVectorTileRows();
  for (const row of rows) {
    const tile = new VectorTile(new Pbf(new Uint8Array(row.data)));
    for (const layerName of Object.keys(tile.layers)) {
      const layer = tile.layers[layerName];
      if (!layer) continue;
      for (let index = 0; index < layer.length; index += 1) {
        const feature = layer.feature(index);
        const geojson = feature.toGeoJSON(row.x, row.y, row.z) as Feature;
        const properties = (geojson.properties ?? {}) as Record<string, unknown>;
        const rawOrigin = properties[HDB_ORIGIN_KEY] ?? properties.originKey;
        const originKey = typeof rawOrigin === 'string' ? String(rawOrigin) : undefined;
        totalFeatures += 1;
        if (!originKey) {
          missingOriginKey += 1;
          continue;
        }
        const stats = extractGeometryStats(geojson);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
        statsByOrigin.set(originKey, {
          vertexCount: existing.vertexCount + stats.vertexCount,
          polygonCount: existing.polygonCount + stats.polygonCount,
        });
      }
    }
  }

  if (missingOriginKey > 0) {
    console.warn(`[Session ${String(nodeId)}] Vector tile features missing origin key`, {
      totalFeatures,
      missingOriginKey,
    });
  }

  return statsByOrigin;
}
