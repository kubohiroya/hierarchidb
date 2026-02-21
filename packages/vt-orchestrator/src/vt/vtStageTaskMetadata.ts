import type { BandConfig, StageHandlerResult } from '~/types/types';
import { parentToChildRange } from '~/tiles/tileId';
import { VT_PARENT_INPUT_SUMMARY_METADATA_KEY } from './vtStageGeometryTypes.js';
import { tileToBBox } from './vtStageGeometryTile.js';
import {
  buildAdminFeatureSummary,
  buildSkippedMessage,
  buildTileSummary,
  buildVtParentInputSummary,
} from './vtStageSummary.js';
import type { CollectedVtFeatures } from './vtStageTaskTypes.js';

const buildTilesByZoom = (
  band: BandConfig,
  parent: { z: number; x: number; y: number },
): Map<number, { total: number; generated: number }> => {
  const tilesByZoom = new Map<number, { total: number; generated: number }>();
  for (let z = band.zMin; z <= band.zMax; z++) {
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    const total = Math.max(0, xEnd - xStart + 1) * Math.max(0, yEnd - yStart + 1);
    tilesByZoom.set(z, { total, generated: 0 });
  }
  return tilesByZoom;
};

export const buildVtParentMetadata = (
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  collected: CollectedVtFeatures,
) => {
  const { collection, featureStats } = collected;
  const adminFeatureSummary = buildAdminFeatureSummary(collection);
  const tilesByZoom = buildTilesByZoom(band, parent);
  const tileSummary = buildTileSummary(tilesByZoom);
  const parentBBox = tileToBBox(parent.z, parent.x, parent.y);
  const parentInputSummary = buildVtParentInputSummary({
    featureStats,
    parentBBox,
    parentTile: parent,
  });
  const parentInputMetadata = {
    [VT_PARENT_INPUT_SUMMARY_METADATA_KEY]: parentInputSummary,
  };
  const totalTiles = Array.from(tilesByZoom.values()).reduce((sum, counts) => sum + counts.total, 0);
  return {
    adminFeatureSummary,
    tilesByZoom,
    totalTiles,
    tileSummary,
    featureStats,
    parentBBox,
    parentInputSummary,
    parentInputMetadata,
    buildCompletedResult: (message: string): StageHandlerResult => ({
      status: 'completed',
      message: buildSkippedMessage(adminFeatureSummary, tileSummary, message),
      metadata: parentInputMetadata,
    }),
  };
};
