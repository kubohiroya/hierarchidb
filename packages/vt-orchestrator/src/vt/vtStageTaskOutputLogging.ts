import type { Tile } from 'geojson-vt';
import type { VtInputTileStats, VtOutputTileStats } from './vtStageTaskOutputHelpers.js';

export type TileLayerFeatureCount = {
  layerName: string;
  featureCount: number;
};

type TileProgressMessageInput = {
  processedTiles: number;
  totalTiles: number;
  z: number;
  x: number;
  y: number;
  inputStats: VtInputTileStats;
  outputStats: VtOutputTileStats;
  layerFeatureCounts?: TileLayerFeatureCount[];
};

export const buildTileLayerFeatureCounts = (
  layers: Record<string, Tile>
): TileLayerFeatureCount[] =>
  Object.entries(layers).map(([layerName, tile]) => ({
    layerName,
    featureCount: Array.isArray(tile.features) ? tile.features.length : 0,
  }));

export const buildInitialTileProgressMessage = (totalTiles: number): string =>
  `tiles 0/${totalTiles}`;

export const buildTileProgressMessage = ({
  processedTiles,
  totalTiles,
  z,
  x,
  y,
  inputStats,
  outputStats,
  layerFeatureCounts,
}: TileProgressMessageInput): string =>
  `tiles ${processedTiles}/${totalTiles} | tile z=${z} x=${x} y=${y}` +
  ` input(bytes=${inputStats.inputBytes}, features=${inputStats.featureCount}, polygons=${inputStats.polygonCount}, lines=${inputStats.lineStringCount}, vertices=${inputStats.vertexCount})` +
  ` output(features=${outputStats.featureCount}, polygons=${outputStats.polygonCount}, lines=${outputStats.lineStringCount}, vertices=${outputStats.vertexCount})` +
  `${layerFeatureCounts && layerFeatureCounts.length > 0 ? ` layers=${layerFeatureCounts.map(({ layerName, featureCount }) => `${layerName}:${featureCount}`).join('|')}` : ''}`;

export const buildCompletedMessage = (
  adminFeatureSummary: string,
  finalTileSummary: string,
  generatedTiles: number
): string =>
  generatedTiles === 0
    ? `${adminFeatureSummary}, ${finalTileSummary} (skipped: no tiles)`
    : `${adminFeatureSummary}, ${finalTileSummary}`;
