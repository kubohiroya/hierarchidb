import type { NodeId } from '@hierarchidb/core-types';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import { type GeometryEngine, pickAdminCode } from '@hierarchidb/gis-sdk';
import type { ShapeFeatureMetadata } from '@hierarchidb/shape-api';
import type { shapeDB } from '@hierarchidb/shape-store';
import type { CountryMetadata, DataSourceName } from '~/common/types/index';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import {
  buildFeatureId,
  extractGeometryStats,
  measureFeatureGeoJsonByteSize,
  resolveAdminHierarchyFields,
} from './featureMetadataUtils.ts';
import {
  buildCountryLookup,
  decodeGeometryCache,
  isGeometryCacheComplete,
  readNumericProperty,
  resolveFeatureOriginInfo,
} from './shapePipelineShared.ts';
import { updateShapeStageMetadata } from './updateShapeStageMetadata.js';

export type ShapeMetadataStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  ephemeralStore: EphemeralDB;
  shapeDb: typeof shapeDB;
  geometryEngine: GeometryEngine;
  recyclingByFeatureId?: Map<string, boolean>;
  recyclingAllowlist: Set<string>;
  diffBuildEnabled: boolean;
  abortSignal?: AbortSignal;
};

const assertMetadataPipelineActive = (abortSignal?: AbortSignal): void => {
  if (abortSignal?.aborted) {
    throw new DOMException('Shape metadata pipeline was aborted', 'AbortError');
  }
};

export const runShapeMetadataStage = async (params: ShapeMetadataStageParams): Promise<void> => {
  assertMetadataPipelineActive(params.abortSignal);
  const featureMetadataRows = await buildFeatureMetadataFromGeometryCaches(
    params.nodeId,
    params.dataSource,
    params.ephemeralStore,
    params.geometryEngine,
    params.recyclingByFeatureId
  );
  assertMetadataPipelineActive(params.abortSignal);
  if (featureMetadataRows.length > 0) {
    await shapeMutationAPIImpl.putFeatureMetadata(featureMetadataRows);
    assertMetadataPipelineActive(params.abortSignal);
  }

  await updateShapeStageMetadata({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    shapeStore: params.ephemeralStore,
    shapeDb: params.shapeDb,
    abortSignal: params.abortSignal,
  });
  assertMetadataPipelineActive(params.abortSignal);

  if (params.diffBuildEnabled && params.recyclingAllowlist.size > 0) {
    const latestRows = await shapeQueryAPIImpl.listFeatureMetadata(params.nodeId);
    assertMetadataPipelineActive(params.abortSignal);
    const cleared = latestRows
      .filter((row) => params.recyclingAllowlist.has(row.featureId))
      .map((row) => ({
        ...row,
        recycling: false,
      }));
    if (cleared.length > 0) {
      await shapeMutationAPIImpl.putFeatureMetadata(cleared);
      assertMetadataPipelineActive(params.abortSignal);
    }
  }
};

const buildFeatureMetadataFromGeometryCaches = async (
  nodeId: NodeId,
  dataSource: DataSourceName,
  ephemeralStore: EphemeralDB,
  geometryEngine: GeometryEngine,
  recyclingByFeatureId?: Map<string, boolean>
): Promise<ShapeFeatureMetadata[]> => {
  const records: ShapeFeatureMetadata[] = [];
  const createdAt = Date.now();
  const metadata = await metadataLoader.loadMetadata(dataSource, nodeId);
  const countryLookup = buildCountryLookup(metadata as CountryMetadata[]);
  const geometryCacheIdsRaw = await ephemeralStore.geometryCacheMeta
    .where('nodeId')
    .equals(nodeId)
    .primaryKeys();
  const geometryCacheIds = geometryCacheIdsRaw.map((id) => String(id));
  if (geometryCacheIds.length === 0) return records;
  const buffers = await ephemeralStore.geometryCache.bulkGet(geometryCacheIds);
  for (const buffer of buffers) {
    if (!buffer || !isGeometryCacheComplete(buffer)) continue;
    const collection = await decodeGeometryCache(buffer.data);
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
      const adminCode =
        pickAdminCode(properties) ??
        (resolvedAdminLevel === 2
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
        geometryVertexCount: stats.vertexCount,
        geometryPolygonCount: stats.polygonCount,
        geojsonByteSize: measureFeatureGeoJsonByteSize(feature),
        bbox: stats.bbox,
        area: stats.area,
        recycling: recyclingByFeatureId?.get(featureId),
      });
    }
  }
  return records;
};
