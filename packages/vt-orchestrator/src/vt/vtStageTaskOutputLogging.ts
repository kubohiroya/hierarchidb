import type { VtInputTileStats, VtOutputTileStats } from './vtStageTaskOutputHelpers.js';

type TileProgressMessageInput = {
  processedTiles: number;
  totalTiles: number;
  z: number;
  x: number;
  y: number;
  inputStats: VtInputTileStats;
  outputStats: VtOutputTileStats;
};

export const buildInitialTileProgressMessage = (totalTiles: number): string => `tiles 0/${totalTiles}`;

export const buildTileProgressMessage = ({
  processedTiles,
  totalTiles,
  z,
  x,
  y,
  inputStats,
  outputStats,
}: TileProgressMessageInput): string => (
  `tiles ${processedTiles}/${totalTiles} | tile z=${z} x=${x} y=${y}`
  + ` input(bytes=${inputStats.inputBytes}, features=${inputStats.featureCount}, polygons=${inputStats.polygonCount}, lines=${inputStats.lineStringCount}, vertices=${inputStats.vertexCount})`
  + ` output(features=${outputStats.featureCount}, polygons=${outputStats.polygonCount}, lines=${outputStats.lineStringCount}, vertices=${outputStats.vertexCount})`
);

export const buildCompletedMessage = (
  adminFeatureSummary: string,
  finalTileSummary: string,
  generatedTiles: number,
): string => (
  generatedTiles === 0
    ? `${adminFeatureSummary}, ${finalTileSummary} (skipped: no tiles)`
    : `${adminFeatureSummary}, ${finalTileSummary}`
);
