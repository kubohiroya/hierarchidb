import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';
import type { Extract2Task } from '../../../../../../common/types/index.js';
import type { DataSourceName } from '../../../../../../common/types/index.js';
import type { FeatureMetadataPickers } from '../../../../session/metadata/featureMetadata.js';
import { buildFeatureMetadataRecords } from '../../../../session/metadata/featureMetadata.js';

export type TileIndexStats = {
  totalTiles: number;
  acceptedTiles: number;
  skippedSerialization: number;
  skippedSize: number;
};

export type TileRow = { key: string; z: number; x: number; y: number };

export async function ensureTileFeatureIndex(params: {
  nodeId: NodeId;
  extract2Tasks: Extract2Task[];
  zoomLevels: number[];
  resolveDataSource: () => DataSourceName;
  buildStageTileKey: (z: number, x: number, y: number) => string;
  buildTileCoordinates: (bbox: [number, number, number, number], zoomLevels: number[]) => Array<{ z: number; x: number; y: number }>;
  buildFeatureId: (base: string, index: number, countryCode?: string, adminLevel?: number, adminCode?: string) => string;
  pickers: FeatureMetadataPickers;
  extractGeometryStats: (feature: Feature) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  };
  getExtractedBuffer: (id: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => Promise<void>;
  consoleDebug?: (msg: string, obj?: unknown) => void;
}): Promise<{ tileRows: TileRow[]; stats: TileIndexStats }> {
  const {
    nodeId,
    extract2Tasks,
    zoomLevels,
    resolveDataSource,
    buildStageTileKey,
    buildTileCoordinates,
    buildFeatureId,
    pickers,
    extractGeometryStats,
    getExtractedBuffer,
    decodeFeatureCollection,
    putFeatureMetadata,
    consoleDebug,
  } = params;

  // pickers are used by buildFeatureMetadataRecords

  if (zoomLevels.length === 0) {
    return {
      tileRows: [],
      stats: {
        totalTiles: 0,
        acceptedTiles: 0,
        skippedSerialization: 0,
        skippedSize: 0,
      },
    };
  }

  const tilesByKey = new Map<string, { key: string; z: number; x: number; y: number; features: Feature[] }>();
  const createdAt = Date.now();

  for (const task of extract2Tasks) {
    const inputBufferId = task.inputBufferId ?? `${String(nodeId)}-extract2-${task.index ?? 0}`;
    const buffer = await getExtractedBuffer(inputBufferId);
    if (!buffer) continue;

    const collection = await decodeFeatureCollection(buffer.data);
    if (!collection) continue;

    const features = collection.features.filter((f): f is Feature => Boolean(f));
    if (features.length === 0) continue;

    const dataSource = resolveDataSource();
    const metadataRecords: ShapeFeatureMetadataRow[] = buildFeatureMetadataRecords({
      nodeId,
      dataSource,
      createdAt,
      features,
      defaultCountryCode: task.countryCode,
      defaultAdminLevel: task.adminLevel,
      pickers,
      buildFeatureId,
      extractGeometryStats,
    });

    if (metadataRecords.length > 0) {
      await putFeatureMetadata(metadataRecords);
    }

    // tile index
    for (const feature of features) {
      const stats = extractGeometryStats(feature);
      if (!stats.bbox) continue;
      const tiles = buildTileCoordinates(stats.bbox, zoomLevels);
      for (const tile of tiles) {
        const key = buildStageTileKey(tile.z, tile.x, tile.y);
        const existing = tilesByKey.get(key);
        if (existing) {
          existing.features.push(feature);
        } else {
          tilesByKey.set(key, { key, z: tile.z, x: tile.x, y: tile.y, features: [feature] });
        }
      }
    }
  }

  const tileRows = Array.from(tilesByKey.values());
  const acceptedRows: TileRow[] = tileRows.map((row) => ({ key: row.key, z: row.z, x: row.x, y: row.y }));

  const tilesByZoom = acceptedRows.reduce<Record<number, number>>((acc, row) => {
    acc[row.z] = (acc[row.z] ?? 0) + 1;
    return acc;
  }, {});
  consoleDebug?.(`[Session ${String(nodeId)}] Vector tile inputs by zoom`, tilesByZoom);

  return {
    tileRows: acceptedRows,
    stats: {
      totalTiles: tileRows.length,
      acceptedTiles: acceptedRows.length,
      skippedSerialization: 0,
      skippedSize: 0,
    },
  };
}
