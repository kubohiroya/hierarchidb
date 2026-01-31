import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeFeatureMetadata } from '@hierarchidb/shape-api';
import { buildFeatureId, extractGeometryStats } from './featureMetadataUtils.ts';
import { pickAdminCode, pickAdminName } from '@hierarchidb/gis-sdk';
import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { updateShapeStageMetadata } from './shapeStageMetadata.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import type { ephemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';
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
  ephemeralStore: typeof ephemeralShapeDB;
  shapeDb: typeof shapeDB;
  recyclingByFeatureId?: Map<string, boolean>;
  recyclingAllowlist: Set<string>;
  diffBuildEnabled: boolean;
};

export const runShapeMetadataStage = async (params: ShapeMetadataStageParams): Promise<void> => {
  const featureMetadataRows = await buildFeatureMetadataFromTransformCaches(
    params.nodeId,
    params.dataSource,
    params.ephemeralStore,
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
  ephemeralStore: typeof ephemeralShapeDB,
  recyclingByFeatureId?: Map<string, boolean>,
): Promise<ShapeFeatureMetadata[]> => {
  const records: ShapeFeatureMetadata[] = [];
  const createdAt = Date.now();
  const metadata = await metadataLoader.loadMetadata(dataSource, nodeId);
  const countryLookup = buildCountryLookup(metadata as CountryMetadata[]);
  const buffers = await ephemeralStore.transformCache.where('nodeId').equals(nodeId).toArray();
  for (const buffer of buffers) {
    if (!isTransformCacheComplete(buffer)) continue;
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
      const adminCode = pickAdminCode(properties);
      const featureId = buildFeatureId(feature, index, { countryCode, adminLevel, adminCode });
      const stats = extractGeometryStats(feature);
      const fetchVertexCount = readNumericProperty(properties, '__hdbFetchVertexCount');
      const fetchPolygonCount = readNumericProperty(properties, '__hdbFetchPolygonCount');
      records.push({
        id: `${String(nodeId)}-${featureId}`,
        nodeId: String(nodeId),
        featureId,
        countryName: originInfo.countryName,
        countryCode,
        adminName: pickAdminName(properties),
        adminLevel,
        adminCode,
        dataSource,
        createdAt,
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        fetchVertexCount,
        fetchPolygonCount,
        transformVertexCount: stats.vertexCount,
        transformPolygonCount: stats.polygonCount,
        bbox: stats.bbox,
        area: stats.area,
        recycling: recyclingByFeatureId?.get(featureId),
      });
    }
  }
  return records;
};
