import type { Tile } from 'geojson-vt';
import { buildTileProgressMessage, buildTileLayerFeatureCounts } from './vtStageTaskOutputLogging.js';
import { processTileForVtOutput } from './processTileForVtOutput.js';
import type { VtTileOutputWriterInput } from './vtStageTaskOutputTypes.js';

export type TileVisitInput = {
  context: VtTileOutputWriterInput;
  tile: {
    z: number;
    x: number;
    y: number;
    processedTiles: number;
    generatedTiles: number;
  };
};

export type TileVisitResult = {
  generated: boolean;
};

export const handleTileWithoutLayers = async ({
  context: {
    reportTileProgress,
  },
  tile: {
    processedTiles,
    generatedTiles,
  },
}: TileVisitInput): Promise<TileVisitResult> => {
  await reportTileProgress({
    processedTiles,
    generatedTiles,
    force: false,
  });
  return {
    generated: false,
  };
};

export const handleTileWithLayers = async ({
  context,
  tile: {
    z,
    x,
    y,
    processedTiles,
    generatedTiles,
  },
  layers,
}: TileVisitInput & {
  context: VtTileOutputWriterInput;
  layers: Record<string, Tile>;
}): Promise<TileVisitResult> => {
  const {
    taskContext,
    tileEmitConfig,
    vtpbf,
    tileWriter,
    debugCollect,
    featureStats,
    bufferSizes,
    totals,
    tilesByZoom,
    bufferSetHash,
    reportTileProgress,
    totalTiles,
  } = context;

  const { inputStats, outputStats } = await processTileForVtOutput({
    z,
    x,
    y,
    layers,
    taskContext,
    tileEmitConfig,
    vtpbf,
    tileWriter,
    debugCollect,
    bufferSetHash,
    featureStats,
    bufferSizes,
    totals,
  });

  const zoomCounts = tilesByZoom.get(z);
  if (zoomCounts) {
    zoomCounts.generated += 1;
  }
  const layerFeatureCounts = buildTileLayerFeatureCounts(layers);

  const message = buildTileProgressMessage({
    processedTiles,
    totalTiles,
    z,
    x,
    y,
    inputStats,
    outputStats,
    layerFeatureCounts,
  });
  console.debug('[tileEmit] tile persisted', JSON.stringify({
    ...taskContext,
    z,
    x,
    y,
    layerFeatureCounts,
  }));
  await reportTileProgress({
    processedTiles,
    generatedTiles: generatedTiles + 1,
    force: false,
    message,
  });

  return {
    generated: true,
  };
};
