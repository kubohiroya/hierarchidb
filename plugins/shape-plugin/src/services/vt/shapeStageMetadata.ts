import type { Feature, Geometry } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeDataSourceMetadata } from '@hierarchidb/shape-api';
import type { ShapeDB } from '@hierarchidb/shape-store';
import type { EphemeralShapeDB } from '@hierarchidb/gis-sdk';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';

const ORIGIN_KEY_PROP = '__hdbOriginKey';

const buildOriginKey = (dataSource: DataSourceName, sourceKey: string): string => (
  `${dataSource}:${sourceKey}`
);

const splitOriginKey = (originKey: string): { dataSource: string; sourceKey: string } | null => {
  const index = originKey.indexOf(':');
  if (index <= 0) return null;
  return {
    dataSource: originKey.slice(0, index),
    sourceKey: originKey.slice(index + 1),
  };
};

const parseSourceKey = (sourceKey: string): { countryCode?: string; adminLevel?: number } => {
  const [countryCode, adminLevelRaw] = sourceKey.split(':');
  const adminLevel = adminLevelRaw != null ? Number(adminLevelRaw) : undefined;
  return {
    countryCode: countryCode?.trim().toUpperCase() || undefined,
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
  };
};

const buildCountryLookup = (metadata: CountryMetadata[]): Map<string, CountryMetadata> => {
  const map = new Map<string, CountryMetadata>();
  metadata.forEach((entry) => {
    const iso2 = entry.iso2?.trim().toUpperCase() ?? entry.countryCode?.trim().toUpperCase();
    const iso3 = entry.iso3?.trim().toUpperCase();
    if (iso2) map.set(iso2, entry);
    if (iso3) map.set(iso3, entry);
    if (entry.countryCode) map.set(entry.countryCode.trim().toUpperCase(), entry);
  });
  return map;
};

const buildOriginLabel = (countryName?: string, countryCode?: string, adminLevel?: number): string => {
  const country = countryName ?? countryCode ?? 'Unknown';
  if (typeof adminLevel !== 'number') return country;
  return `${country} / ADM${adminLevel}`;
};

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const summarizeGeometry = (geometry?: Geometry | null): { vertexCount: number; polygonCount: number } => ({
  vertexCount: countVerticesFromGeometry(geometry),
  polygonCount: countPolygonsFromGeometry(geometry),
});

type StageTotals = { vertexCount: number; polygonCount: number };

type DataSourceMetadata = {
  originKey: string;
  originLabel: string;
  dataSource: DataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  continent?: string;
  featureGroupId?: string;
  featureLabel?: string;
  createdAt: number;
  updatedAt: number;
  fetch: StageTotals;
  transform: StageTotals;
  vt: StageTotals;
};

const buildOriginBase = (
  originKey: string,
  info: {
    dataSource: DataSourceName;
    countryCode?: string;
    adminLevel?: number;
    countryName?: string;
    continent?: string;
    createdAt: number;
  },
): DataSourceMetadata => ({
  originKey,
  originLabel: buildOriginLabel(info.countryName, info.countryCode, info.adminLevel),
  dataSource: info.dataSource,
  countryCode: info.countryCode,
  countryName: info.countryName,
  adminLevel: info.adminLevel,
  continent: info.continent,
  createdAt: info.createdAt,
  updatedAt: info.createdAt,
  fetch: { vertexCount: 0, polygonCount: 0 },
  transform: { vertexCount: 0, polygonCount: 0 },
  vt: { vertexCount: 0, polygonCount: 0 },
});

const ensureOrigin = (
  map: Map<string, DataSourceMetadata>,
  originKey: string,
  info: {
    dataSource: DataSourceName;
    countryCode?: string;
    adminLevel?: number;
    countryName?: string;
    continent?: string;
    createdAt: number;
  },
): DataSourceMetadata => {
  const existing = map.get(originKey);
  if (existing) return existing;
  const created = buildOriginBase(originKey, info);
  map.set(originKey, created);
  return created;
};

const accumulate = (target: StageTotals, next?: StageTotals | null): void => {
  if (!next) return;
  target.vertexCount += next.vertexCount;
  target.polygonCount += next.polygonCount;
};

const resolveOriginInfo = (
  originKey: string,
  lookup: Map<string, CountryMetadata>,
): { countryCode?: string; adminLevel?: number; countryName?: string; continent?: string } => {
  const parts = splitOriginKey(originKey);
  const sourceKey = parts?.sourceKey ?? originKey;
  const { countryCode, adminLevel } = parseSourceKey(sourceKey);
  const meta = countryCode ? lookup.get(countryCode) : undefined;
  return {
    countryCode,
    adminLevel,
    countryName: meta?.countryName,
    continent: meta?.continent,
  };
};

const readTileFeatureStats = (
  data: ArrayBuffer,
  x: number,
  y: number,
  z: number,
): Array<{ originKey: string; stats: StageTotals }> => {
  const result: Array<{ originKey: string; stats: StageTotals }> = [];
  const tile = new VectorTile(new Pbf(new Uint8Array(data)));
  Object.values(tile.layers).forEach((layer) => {
    for (let index = 0; index < layer.length; index += 1) {
      const feature = layer.feature(index);
      const originKey = feature.properties?.[ORIGIN_KEY_PROP];
      if (typeof originKey !== 'string' || originKey.length === 0) continue;
      const geojson = feature.toGeoJSON(x, y, z) as Feature;
      const stats = summarizeGeometry(geojson.geometry ?? null);
      result.push({ originKey, stats });
    }
  });
  return result;
};

export type ShapeStageMetadataParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  shapeStore: EphemeralShapeDB;
  shapeDb: ShapeDB;
};

export const updateShapeStageMetadata = async (params: ShapeStageMetadataParams): Promise<void> => {
  const metadata = await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  const lookup = buildCountryLookup(metadata);
  const now = Date.now();
  const existingRows = await params.shapeDb.dataSourceMetadata
    .where('nodeId')
    .equals(String(params.nodeId))
    .toArray() as ShapeDataSourceMetadata[];
  const createdAtByOrigin = new Map(existingRows.map((row) => [row.originKey, row.createdAt] as const));

  const origins = new Map<string, DataSourceMetadata>();

  await params.shapeStore.fetchCacheMeta.where('nodeId').equals(params.nodeId).each((buffer) => {
    const originKey = buildOriginKey(params.dataSource, buffer.sourceKey);
    const info = resolveOriginInfo(originKey, lookup);
    const origin = ensureOrigin(origins, originKey, {
      dataSource: params.dataSource,
      countryCode: buffer.countryCode ?? info.countryCode,
      adminLevel: buffer.adminLevel ?? info.adminLevel,
      countryName: info.countryName,
      continent: info.continent,
      createdAt: createdAtByOrigin.get(originKey) ?? now,
    });
    accumulate(origin.fetch, {
      vertexCount: buffer.vertexCount ?? 0,
      polygonCount: buffer.polygonCount ?? 0,
    });
  });

  await params.shapeStore.transformCacheMeta.where('nodeId').equals(params.nodeId).each((buffer) => {
    if (buffer.domainType !== 'shape') return;
    const originKey = buildOriginKey(params.dataSource, buffer.sourceKey);
    const info = resolveOriginInfo(originKey, lookup);
    const origin = ensureOrigin(origins, originKey, {
      dataSource: params.dataSource,
      countryCode: buffer.countryCode ?? info.countryCode,
      adminLevel: buffer.adminLevel ?? info.adminLevel,
      countryName: info.countryName,
      continent: info.continent,
      createdAt: createdAtByOrigin.get(originKey) ?? now,
    });
    accumulate(origin.transform, {
      vertexCount: buffer.vertexCount ?? 0,
      polygonCount: buffer.polygonCount ?? 0,
    });
  });

  const tiles = await params.shapeDb.vectorTiles.where('nodeId').equals(params.nodeId).toArray();
  tiles.forEach((tile) => {
    const buffer = tile.data_Uint8Array.buffer.slice(
      tile.data_Uint8Array.byteOffset,
      tile.data_Uint8Array.byteOffset + tile.data_Uint8Array.byteLength,
    );
    const stats = readTileFeatureStats(buffer, tile.x, tile.y, tile.z);
    stats.forEach(({ originKey, stats }) => {
      const info = resolveOriginInfo(originKey, lookup);
      const origin = ensureOrigin(origins, originKey, {
        dataSource: params.dataSource,
        countryCode: info.countryCode,
        adminLevel: info.adminLevel,
        countryName: info.countryName,
        continent: info.continent,
        createdAt: createdAtByOrigin.get(originKey) ?? now,
      });
      accumulate(origin.vt, stats);
    });
  });

  const rows: ShapeDataSourceMetadata[] = Array.from(origins.values()).map((origin) => ({
    id: `${String(params.nodeId)}:${origin.originKey}`,
    nodeId: String(params.nodeId),
    originKey: origin.originKey,
    originLabel: origin.originLabel,
    dataSource: origin.dataSource,
    countryName: origin.countryName,
    countryCode: origin.countryCode,
    continent: origin.continent,
    adminLevel: origin.adminLevel,
    featureGroupId: origin.featureGroupId,
    featureLabel: origin.featureLabel,
    createdAt: origin.createdAt,
    updatedAt: now,
    fetchVertexCount: origin.fetch.vertexCount,
    fetchPolygonCount: origin.fetch.polygonCount,
    transformVertexCount: origin.transform.vertexCount,
    transformPolygonCount: origin.transform.polygonCount,
    vtVertexCount: origin.vt.vertexCount,
    vtPolygonCount: origin.vt.polygonCount,
  }));

  await shapeMutationAPIImpl.deleteDataSourceMetadataByNode(params.nodeId);
  await shapeMutationAPIImpl.putDataSourceMetadata(rows);
};
