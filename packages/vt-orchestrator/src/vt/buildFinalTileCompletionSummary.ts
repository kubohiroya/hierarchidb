import { buildTileSummary } from './vtStageSummary.js';
import { buildCompletedMessage } from './vtStageTaskOutputLogging.js';

type VtTileCompletionSummary = {
  finalTileSummary: string;
  message: string;
};

export const buildFinalTileCompletionSummary = ({
  adminFeatureSummary,
  tilesByZoom,
  generatedTiles,
}: {
  adminFeatureSummary: string;
  tilesByZoom: Map<number, { total: number; generated: number }>;
  generatedTiles: number;
}): VtTileCompletionSummary => {
  const finalTileSummary = buildTileSummary(tilesByZoom);
  const message = buildCompletedMessage(adminFeatureSummary, finalTileSummary, generatedTiles);

  return { finalTileSummary, message };
};
