import type { BandConfig } from '~/types/types';
import { buildGeojsonVtEmptyTileSummaryReason } from './vtStageSummary.js';
import {
  GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT,
} from './vtStageDebug.js';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import type { GeojsonVtEmptyTileDetail } from './vtStageSummary.js';
import type { PerTileLayerStats } from './vtStageTaskLayerBuilderStrategyPerTileLoop.js';

type NoLayerWarningInput = {
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  band: BandConfig;
  totalTiles: number;
  layerCount: number;
  intersectingFeatureCount: number;
  layerStats: PerTileLayerStats[];
};

type EmptyTileSummaryInput = {
  taskContext: TaskLayerContext;
  parent: { z: number; x: number; y: number };
  band: BandConfig;
  totalTiles: number;
  emptyTilesWithFeatures: GeojsonVtEmptyTileDetail[];
  debugFocusConfig: VtDebugFocusConfig;
};

export const logPerTileLayerNoResult = ({
  taskContext,
  parent,
  band,
  totalTiles,
  layerCount,
  intersectingFeatureCount,
  layerStats,
}: NoLayerWarningInput): void => {
  console.warn('[tileEmit] per-tile index produced no layers', JSON.stringify({
    ...taskContext,
    parentTile: parent,
    zRange: [band.zMin, band.zMax],
    totalTiles,
    layerCount,
    intersectingFeatureCount,
    layerStats,
  }));
};

export const logPerTileEmptyTilesSummary = ({
  taskContext,
  parent,
  band,
  totalTiles,
  emptyTilesWithFeatures,
  debugFocusConfig,
}: EmptyTileSummaryInput): void => {
  if (emptyTilesWithFeatures.length === 0) return;

  const firstEmptyTileDetail = emptyTilesWithFeatures[0];
  const emptyTileReason = firstEmptyTileDetail
    ? buildGeojsonVtEmptyTileSummaryReason(emptyTilesWithFeatures.length, firstEmptyTileDetail)
    : 'geojson-vt produced empty tile for clipped features';

  console.warn('[tileEmit] geojson-vt produced empty tile for clipped features', JSON.stringify({
    ...taskContext,
    parentTile: parent,
    zRange: [band.zMin, band.zMax],
    totalTiles,
    emptyTileCount: emptyTilesWithFeatures.length,
    firstEmptyTile: firstEmptyTileDetail,
    sampleEmptyTiles: emptyTilesWithFeatures.slice(0, GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT),
  }));
  if (debugFocusConfig.enabled && firstEmptyTileDetail) {
    console.warn('[tileEmit][focus] empty tile summary', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      reason: emptyTileReason,
      sampleEmptyTiles: emptyTilesWithFeatures.slice(0, GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT),
    }));
  }
};
