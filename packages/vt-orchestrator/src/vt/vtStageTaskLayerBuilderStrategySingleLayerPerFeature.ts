import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import type { BandConfig } from '~/types/types';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';
import { parentToChildRange, packTileId } from '~/tiles/tileId';
import { featureBBox, isEmptyGeometry } from './vtStageGeometryFeature.js';
import { clipFeatureForTile } from './vtStageGeometryClipping.js';
import { countVerticesFromGeometry } from './vtStageGeometryCounts.js';
import { bboxIntersects, expandTileBBox, tileToBBox } from './vtStageGeometryTile.js';
import { mergeLayerTiles } from './vtStageTaskLayerBuilderHelpers.js';
import type { BuildLayerIndexForTile } from './vtStageTaskLayerBuilderTypes.js';
import { logSingleLayerPerFeatureNoResult } from './vtStageTaskLayerBuilderStrategySingleLayerLog.js';

type SingleLayerPerFeatureInput = {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  layerName: string;
  features: Feature<Geometry>[];
  assertNotAborted: (signal?: AbortSignal) => void;
  buildLayerIndexForTile: BuildLayerIndexForTile;
};

export const calculateSingleLayerVertexStats = (
  features: Feature<Geometry>[],
) => ({
  layerVertexCount: features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0),
  maxFeatureVertices: features.reduce(
    (max, feature) => Math.max(max, countVerticesFromGeometry(feature.geometry)),
    0,
  ),
});

export const buildLayerByFeatureIndex = async ({
  context,
  taskContext,
  band,
  parent,
  layerName,
  features,
  assertNotAborted,
  buildLayerIndexForTile,
}: SingleLayerPerFeatureInput): Promise<Map<number, Record<string, Tile>>> => {
  const { bufferSize, extent } = context.vtConfig;
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const feature of features) {
    assertNotAborted(context.abortSignal);
    const featureBox = featureBBox(feature);
    if (!featureBox) continue;
    for (let z = band.zMin; z <= band.zMax; z++) {
      assertNotAborted(context.abortSignal);
      const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
      for (let x = xStart; x <= xEnd; x++) {
        assertNotAborted(context.abortSignal);
        for (let y = yStart; y <= yEnd; y++) {
          assertNotAborted(context.abortSignal);
          const tileBBox = expandTileBBox(tileToBBox(z, x, y), bufferSize, extent);
          if (!bboxIntersects(featureBox, tileBBox)) continue;
          const clipped = clipFeatureForTile(feature, tileBBox);
          if (!clipped || isEmptyGeometry(clipped.geometry)) continue;
          const tile = await buildLayerIndexForTile(layerName, [clipped], z, x, y);
          if (!tile) continue;
          const tileId = packTileId(x, y, z);
          const existing = aggregatedLayersByTileId.get(tileId);
          if (existing) {
            mergeLayerTiles(existing, { [layerName]: tile });
          } else {
            aggregatedLayersByTileId.set(tileId, { [layerName]: tile });
          }
        }
      }
    }
  }

  if (aggregatedLayersByTileId.size === 0) {
    logSingleLayerPerFeatureNoResult({
      taskContext,
      parent,
      band,
      layerName,
      featureCount: features.length,
    });
  }

  return aggregatedLayersByTileId;
};
