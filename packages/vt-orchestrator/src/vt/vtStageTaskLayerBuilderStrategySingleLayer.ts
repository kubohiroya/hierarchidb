import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import { geometryBboxClip } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contexts';
import { parentToChildRange, packTileId } from '~/tiles/tileId';
import type { BandConfig } from '~/types/types';
import {
  countVerticesFromGeometry,
  bboxIntersects,
  expandTileBBox,
  featureBBox,
  isAnyPointInBBox,
  isClipGeometry,
  isEmptyGeometry,
  isPointGeometry,
  tileToBBox,
} from './vtStageGeometry.js';
import {
  buildLayerIndexes,
  type GeojsonVtIndex,
} from './vtStageTileIndex.js';
import { mergeLayerTiles } from './vtStageTaskLayerBuilderHelpers.js';

type TaskLayerContext = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

type BuildLayerIndexForTile = (
  layerName: string,
  features: Feature<Geometry>[],
  z: number,
  x: number,
  y: number,
) => Promise<Tile | null>;

type LayerBuildBranchResult = {
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null;
  indexes: Map<string, GeojsonVtIndex> | null;
};

export const buildLayersWithSingleLayer = async (
  context: VTStageContext,
  taskContext: TaskLayerContext,
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  layerMap: Map<string, Feature<Geometry>[]>,
  debugCollect: boolean,
  assertNotAborted: (signal?: AbortSignal) => void,
  buildLayerIndexForTile: BuildLayerIndexForTile,
): Promise<LayerBuildBranchResult> => {
  const entry = layerMap.entries().next();
  if (!entry.value) {
    return { aggregatedLayersByTileId: new Map(), indexes: null };
  }
  const [layerName, features] = entry.value;
  const perFeatureVertexThreshold = 20000;
  const perFeatureMaxVertices = 10000;
  const layerVertexCount = features
    ? features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0)
    : 0;
  const maxFeatureVertices = features
    ? features.reduce(
      (max, feature) => Math.max(max, countVerticesFromGeometry(feature.geometry)),
      0,
    )
    : 0;
  const usePerFeatureIndex = layerVertexCount >= perFeatureVertexThreshold
    || maxFeatureVertices >= perFeatureMaxVertices;
  if (usePerFeatureIndex && features) {
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
            const tileBBox = expandTileBBox(
              tileToBBox(z, x, y),
              context.vtConfig.bufferSize,
              context.vtConfig.extent,
            );
            if (!bboxIntersects(featureBox, tileBBox)) continue;
            const geometry = feature.geometry;
            let clipped: Feature<Geometry> | null = null;
            if (geometry && isClipGeometry(geometry)) {
              const clipFeature = feature as Feature<
                Geometry & { type: 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' }
              >;
              clipped = geometryBboxClip(
                clipFeature,
                [tileBBox.minX, tileBBox.minY, tileBBox.maxX, tileBBox.maxY],
                'turf',
              ) as Feature<Geometry>;
            } else if (geometry && isPointGeometry(geometry)) {
              if (isAnyPointInBBox(geometry, tileBBox)) {
                clipped = feature as Feature<Geometry>;
              }
            }
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
      console.warn('[vt] per-feature index produced no layers', JSON.stringify({
        ...taskContext,
        parentTile: parent,
        zRange: [band.zMin, band.zMax],
        layerName,
        featureCount: features.length,
        layerVertexCount,
        maxFeatureVertices,
      }));
    }
    return { aggregatedLayersByTileId, indexes: null };
  }

  if (debugCollect) {
    console.info('[vt][debug] buildLayerIndexes start', JSON.stringify({
      ...taskContext,
      layerCount: layerMap.size,
      heap: null,
    }));
  }
  const indexes = await buildLayerIndexes(context, layerMap, band, taskContext);
  if (debugCollect) {
    console.info('[vt][debug] buildLayerIndexes done', JSON.stringify({
      ...taskContext,
      indexCount: indexes.size,
      heap: null,
    }));
  }
  return { aggregatedLayersByTileId: null, indexes };
};
