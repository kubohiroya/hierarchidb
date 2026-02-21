import type { StageHandlerResult } from '~/types/types';

type VtFinalOutputInput = {
  generatedTiles: number;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
  finalMessage: string;
};

export const buildTileOutputResult = ({
  generatedTiles,
  totalTiles,
  parentInputMetadata,
  finalMessage,
}: VtFinalOutputInput): StageHandlerResult => ({
  status: 'completed',
  progress: 100,
  message: finalMessage,
  metadata: parentInputMetadata,
  outputData: {
    tilesGenerated: generatedTiles,
    totalTiles,
  },
});
