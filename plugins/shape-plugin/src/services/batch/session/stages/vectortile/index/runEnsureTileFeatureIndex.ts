import type { NodeId } from '@hierarchidb/common-types';
import type { Extract2Task, DataSourceName } from '../../../../../../common/types/index.js';
import type { Feature } from 'geojson';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';

export type TileRow = { key: string; z: number; x: number; y: number };

export type EnsureTileFeatureIndexResult = {
  tileRows: TileRow[];
  stats: {
    totalTiles: number;
    acceptedTiles: number;
    skippedSerialization: number;
    skippedSize: number;
  };
};

type FeatureCollectionLike = { type: 'FeatureCollection'; features: Feature[] };

export async function runEnsureTileFeatureIndex(params: {
  nodeId: NodeId;
  extract2Tasks: Extract2Task[];
  zoomLevels: number[];
  ensureTileFeatureIndex: (args: {
    nodeId: NodeId;
    extract2Tasks: Extract2Task[];
    zoomLevels: number[];
    resolveDataSource: () => DataSourceName;
    buildStageTileKey: (z: number, x: number, y: number) => string;
    buildTileCoordinates: (bbox: [number, number, number, number], zoomLevels: number[]) => Array<{ z: number; x: number; y: number }>;
    buildFeatureId: (base: string, index: number, countryCode?: string, adminLevel?: number, adminCode?: string) => string;
    pickers: unknown;
    extractGeometryStats: (feature: Feature) => { vertexCount: number; polygonCount: number; bbox?: [number, number, number, number]; area: number };
    getExtractedBuffer: (id: string) => Promise<{ data: ArrayBuffer } | null>;
    decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollectionLike | null>;
    putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => Promise<void>;
    consoleDebug: (message: string, data?: unknown) => void;
  }) => Promise<{ tileRows: TileRow[]; stats: EnsureTileFeatureIndexResult['stats'] }>;
  resolveDataSource: () => DataSourceName;
  buildStageTileKey: (z: number, x: number, y: number) => string;
  buildTileCoordinates: (bbox: [number, number, number, number], zoomLevels: number[]) => Array<{ z: number; x: number; y: number }>;
  buildFeatureId: (base: string, index: number, countryCode?: string, adminLevel?: number, adminCode?: string) => string;
  pickers: unknown;
  extractGeometryStats: (feature: Feature) => { vertexCount: number; polygonCount: number; bbox?: [number, number, number, number]; area: number };
  getExtractedBuffer: (id: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollectionLike | null>;
  putFeatureMetadata: (rows: ShapeFeatureMetadataRow[]) => Promise<void>;
  consoleDebug: (message: string, data?: unknown) => void;
}): Promise<EnsureTileFeatureIndexResult> {
  const res = await params.ensureTileFeatureIndex({
    nodeId: params.nodeId,
    extract2Tasks: params.extract2Tasks,
    zoomLevels: params.zoomLevels,
    resolveDataSource: params.resolveDataSource,
    buildStageTileKey: params.buildStageTileKey,
    buildTileCoordinates: params.buildTileCoordinates,
    buildFeatureId: params.buildFeatureId,
    pickers: params.pickers,
    extractGeometryStats: params.extractGeometryStats,
    getExtractedBuffer: params.getExtractedBuffer,
    decodeFeatureCollection: params.decodeFeatureCollection,
    putFeatureMetadata: params.putFeatureMetadata,
    consoleDebug: params.consoleDebug,
  });

  return { tileRows: res.tileRows, stats: res.stats };
}
