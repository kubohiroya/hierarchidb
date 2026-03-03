import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import type { BandConfig } from '~/types/types';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import type { GeojsonVtEmptyTileDetail } from './vtStageSummary.js';
import { iterateChildTiles } from './iterateChildTiles.js';
import type {
  BuildLayerIndexForTile,
  TaskLayerContext,
} from './vtStageTaskLayerBuilderTypes.js';
import type { PerTileLayerFeatureMap } from './vtStageTaskLayerBuilderStrategyPerTileLoopLayerUtils.js';
import {
  buildFeaturesWithBBoxByLayer,
  resolvePerTileLayerContribution,
} from './vtStageTaskLayerBuilderStrategyPerTileLoopLayerUtils.js';
import { expandTileBBox, resolveTileBufferPx, tileToBBox } from './vtStageGeometryTile.js';

type PerTileLayerExecutionInput = {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  layerMap: Map<string, Feature<Geometry>[]>;
  debugFocusConfig: VtDebugFocusConfig;
  assertNotAborted: (signal?: AbortSignal) => void;
  buildLayerIndexForTile: BuildLayerIndexForTile;
};

export type PerTileLayerStats = {
  layerName: string;
  featureCount: number;
  featuresWithBBox: number;
};

export type PerTileLayerExecutionResult = {
  aggregatedLayersByTileId: Map<number, Record<string, Tile>>;
  emptyTilesWithFeatures: GeojsonVtEmptyTileDetail[];
  layerStats: PerTileLayerStats[];
};

export const executePerTileLayerBuild = async (
  input: PerTileLayerExecutionInput,
): Promise<PerTileLayerExecutionResult> => {
  const {
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugFocusConfig,
    assertNotAborted,
    buildLayerIndexForTile,
  } = input;

  const { extent } = context.tileEmitConfig;
  const tileBuffer = resolveTileBufferPx(context.tileEmitConfig);
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  const emptyTilesWithFeatures: GeojsonVtEmptyTileDetail[] = [];
  const featuresWithBBoxByLayer: PerTileLayerFeatureMap = buildFeaturesWithBBoxByLayer({
    layerMap,
    taskContext,
  });

  for (const { z, x, y, tileId } of iterateChildTiles({
    parent,
    band,
    assertNotAborted,
    abortSignal: context.abortSignal,
  })) {
    const tileBBox = expandTileBBox(tileToBBox(z, x, y), tileBuffer, extent);
    const layersForTile: Record<string, Tile> = {};
    for (const [layerName, featuresWithBBox] of featuresWithBBoxByLayer.entries()) {
      if (featuresWithBBox.length === 0) continue;

      const tileKey = `${z}/${x}/${y}`;
      const { tile, emptyTileDetail } = await resolvePerTileLayerContribution({
        context: taskContext,
        tileKey,
        parent,
        layerName,
        featuresWithBBox,
        tileBBox,
        z,
        x,
        y,
        buildLayerIndexForTile,
        debugFocusConfig,
      });

      if (!tile) {
        if (emptyTileDetail) {
          emptyTilesWithFeatures.push(emptyTileDetail);
        }
        continue;
      }
      layersForTile[layerName] = tile;
    }
    if (Object.keys(layersForTile).length === 0) continue;
    aggregatedLayersByTileId.set(tileId, layersForTile);
  }

  return {
    aggregatedLayersByTileId,
    emptyTilesWithFeatures,
    layerStats: Array.from(layerMap.entries()).map(([layerName, features]) => ({
      layerName,
      featureCount: features.length,
      featuresWithBBox: featuresWithBBoxByLayer.get(layerName)?.length ?? 0,
    })),
  };
};
