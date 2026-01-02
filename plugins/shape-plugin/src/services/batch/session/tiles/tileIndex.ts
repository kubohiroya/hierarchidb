import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';
import type { DataSourceName, Extract2Task } from '../../../../common/types/index.js';
import {
  buildFeatureMetadataRecords,
  type FeatureIdBuilder,
  type FeatureMetadataPickers,
  type GeometryStatsExtractor,
} from '../metadata/featureMetadata.js';

export type TileIndexStats = {
  totalTiles: number;
  acceptedTiles: number;
  skippedSerialization: number;
  skippedSize: number;
};

export type TileIndexStore = {
  getExtractedBuffer: (id: string) => Promise<null | { data: ArrayBuffer }>;
  putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => Promise<void>;
};

export type FeatureCollectionDecoder = (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;

export type TileKeyBuilder = (z: number, x: number, y: number) => string;

export type TileCoordinate = { z: number; x: number; y: number };

export type TileCoordinateBuilder = (
  bbox: [number, number, number, number],
  zoomLevels: number[],
) => TileCoordinate[];

export async function ensureTileFeatureIndex(params: {
  nodeId: NodeId;
  extract2Tasks: Extract2Task[];
  zoomLevels: number[];
  store: TileIndexStore;
  decodeFeatureCollection: FeatureCollectionDecoder;
  buildTileCoordinates: TileCoordinateBuilder;
  buildStageTileKey: TileKeyBuilder;
  resolveDataSource: () => DataSourceName;
  pickers: FeatureMetadataPickers;
  buildFeatureId: FeatureIdBuilder;
  extractGeometryStats: GeometryStatsExtractor;
}): Promise<{ tiles: Array<{ key: string; z: number; x: number; y: number }>; stats: TileIndexStats } > {
  const {
    nodeId,
    extract2Tasks,
    zoomLevels,
    store,
    decodeFeatureCollection,
    buildTileCoordinates,
    buildStageTileKey,
    resolveDataSource,
    pickers,
    buildFeatureId,
    extractGeometryStats,
  } = params;

  if (zoomLevels.length === 0) {
    return {
      tiles: [],
      stats: {
        totalTiles: 0,
        acceptedTiles: 0,
        skippedSerialization: 0,
        skippedSize: 0,
      },
    };
  }

  const tilesByKey = new Map<string, { key: string; z: number; x: number; y: number; features: Feature[] }>();
  const metadataRecords: ShapeFeatureMetadataRow[] = [];
  const createdAt = Date.now();

  for (const task of extract2Tasks) {
    const inputBufferId = task.inputBufferId ?? `${String(nodeId)}-extract2-${task.index ?? 0}`;
    const buffer = await store.getExtractedBuffer(inputBufferId);
    if (!buffer) continue;
    const collection = await decodeFeatureCollection(buffer.data);
    if (!collection) continue;

    const records = buildFeatureMetadataRecords({
      nodeId,
      dataSource: resolveDataSource(),
      createdAt,
      features: collection.features,
      defaultCountryCode: task.countryCode,
      defaultAdminLevel: task.adminLevel,
      pickers,
      buildFeatureId,
      extractGeometryStats,
    });
    metadataRecords.push(...records);

    for (const feature of collection.features) {
      if (!feature) continue;
      const stats = extractGeometryStats(feature);
      if (!stats.bbox) continue;
      const tiles = buildTileCoordinates(stats.bbox, zoomLevels);
      for (const tile of tiles) {
        const key = buildStageTileKey(tile.z, tile.x, tile.y);
        const existingEntry = tilesByKey.get(key);
        if (existingEntry) {
          existingEntry.features.push(feature);
        } else {
          tilesByKey.set(key, { key, z: tile.z, x: tile.x, y: tile.y, features: [feature] });
        }
      }
    }
  }

  if (metadataRecords.length > 0) {
    await store.putFeatureMetadata(metadataRecords);
  }

  const tileRows = Array.from(tilesByKey.values());
  const acceptedRows = tileRows.map((row) => ({ key: row.key, z: row.z, x: row.x, y: row.y }));

  return {
    tiles: acceptedRows,
    stats: {
      totalTiles: tileRows.length,
      acceptedTiles: acceptedRows.length,
      skippedSerialization: 0,
      skippedSize: 0,
    },
  };
}
