import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeFeatureMetadata } from '@hierarchidb/shape-api';
import {
  buildFeatureId,
  extractGeometryStats,
  measureFeatureGeoJsonByteSize,
  resolveAdminHierarchyFields,
} from './featureMetadataUtils.ts';
import { pickAdminCode, type GeometryEngine } from '@hierarchidb/gis-sdk';
import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { updateShapeStageMetadata } from './shapeStageMetadata.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import type { shapeDB } from '@hierarchidb/shape-store';
import {
  buildCountryLookup,
  decodeTransformCache,
  isTransformCacheComplete,
  readNumericProperty,
  resolveFeatureOriginInfo,
} from './shapePipelineShared.ts';

export type ShapeMetadataStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  ephemeralStore: EphemeralDB;
  shapeDb: typeof shapeDB;
  geometryEngine: GeometryEngine;
  recyclingByFeatureId?: Map<string, boolean>;
  recyclingAllowlist: Set<string>;
  diffBuildEnabled: boolean;
};

export const runShapeMetadataStage = async (params: ShapeMetadataStageParams): Promise<void> => {
  const featureMetadataRows = await buildFeatureMetadataFromTransformCaches(
    params.nodeId,
    params.dataSource,
    params.ephemeralStore,
    params.geometryEngine,
    params.recyclingByFeatureId,
  );
  if (featureMetadataRows.length > 0) {
    await shapeMutationAPIImpl.putFeatureMetadata(featureMetadataRows);
  }

  await updateShapeStageMetadata({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    shapeStore: params.ephemeralStore,
    shapeDb: params.shapeDb,
  });

  if (params.diffBuildEnabled && params.recyclingAllowlist.size > 0) {
    const latestRows = await shapeQueryAPIImpl.listFeatureMetadata(params.nodeId);
    const cleared = latestRows.filter((row) => params.recyclingAllowlist.has(row.featureId)).map((row) => ({
      ...row,
      recycling: false,
    }));
    if (cleared.length > 0) {
      await shapeMutationAPIImpl.putFeatureMetadata(cleared);
    }
  }
};

const buildFeatureMetadataFromTransformCaches = async (
  nodeId: NodeId,
  dataSource: DataSourceName,
  ephemeralStore: EphemeralDB,
  geometryEngine: GeometryEngine,
  recyclingByFeatureId?: Map<string, boolean>,
): Promise<ShapeFeatureMetadata[]> => {
  const records: ShapeFeatureMetadata[] = [];
  const createdAt = Date.now();
  const metadata = await metadataLoader.loadMetadata(dataSource, nodeId);
  const countryLookup = buildCountryLookup(metadata as CountryMetadata[]);
  const transformCacheIdsRaw = await ephemeralStore.transformCacheMeta.where('nodeId').equals(nodeId).primaryKeys();
  const transformCacheIds = transformCacheIdsRaw.map((id) => String(id));
  if (transformCacheIds.length === 0) return records;
  const buffers = await ephemeralStore.transformCache.bulkGet(transformCacheIds);
  for (const buffer of buffers) {
    if (!buffer || !isTransformCacheComplete(buffer)) continue;
    const collection = await decodeTransformCache(buffer.data);
    if (!collection) continue;
    for (let index = 0; index < collection.features.length; index += 1) {
      const feature = collection.features[index];
      if (!feature) continue;
      feature.properties = feature.properties ?? {};
      const properties = feature.properties as Record<string, unknown>;
      const originInfo = resolveFeatureOriginInfo(properties, countryLookup);
      const countryCode = originInfo.countryCode;
      const adminLevel = originInfo.adminLevel;
      const adminHierarchy = resolveAdminHierarchyFields({
        properties,
        countryCode,
        adminLevel,
      });
      const resolvedAdminLevel = adminHierarchy.resolvedAdminLevel ?? adminLevel;
      const adminCode = pickAdminCode(properties)
        ?? (resolvedAdminLevel === 2
          ? adminHierarchy.admin2Code
          : resolvedAdminLevel === 1
            ? adminHierarchy.admin1Code
            : adminHierarchy.admin0Code);
      const featureId = buildFeatureId(feature, index, { countryCode, adminLevel, adminCode });
      const stats = extractGeometryStats(feature, geometryEngine);
      const fetchVertexCount = readNumericProperty(properties, '__hdbFetchVertexCount');
      const fetchPolygonCount = readNumericProperty(properties, '__hdbFetchPolygonCount');
      records.push({
        id: `${String(nodeId)}-${featureId}`,
        nodeId: String(nodeId),
        featureId,
        countryName: originInfo.countryName,
        countryCode,
        adminLevel: resolvedAdminLevel,
        admin0Name: originInfo.countryName,
        admin0Code: adminHierarchy.admin0Code,
        admin1Name: adminHierarchy.admin1Name,
        admin1Code: adminHierarchy.admin1Code,
        admin2Name: adminHierarchy.admin2Name,
        admin2Code: adminHierarchy.admin2Code,
        dataSource,
        createdAt,
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        fetchVertexCount,
        fetchPolygonCount,
        transformVertexCount: stats.vertexCount,
        transformPolygonCount: stats.polygonCount,
        geojsonByteSize: measureFeatureGeoJsonByteSize(feature),
        bbox: stats.bbox,
        area: stats.area,
        recycling: recyclingByFeatureId?.get(featureId),
      });
    }
  }
  return records;
};
