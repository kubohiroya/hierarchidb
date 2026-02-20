import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import { parentToChildRange, packTileId } from '~/tiles/tileId';
import type { BandConfig } from '~/types/types';
import {
  GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT,
  type VtDebugFocusConfig,
  resolveVtDebugFocusMatch,
} from './vtStageDebug.js';
import {
  buildLayerMap,
  collectUniqueFeatureIds,
  expandTileBBox,
  tileToBBox,
} from './vtStageGeometry.js';
import {
  buildGeojsonVtEmptyTileSummaryReason,
  type GeojsonVtEmptyTileDetail,
} from './vtStageSummary.js';
import {
  type FeatureWithBBox,
  buildFeaturesWithBBox,
  clipFeaturesForTile,
} from './vtStageCore.js';
import {
  type GeojsonVtIndex,
  buildLayerIndexes,
} from './vtStageTileIndex.js';
import {
  collectLayersForTileFromIndexes,
  collectLayerForTile,
  mergeLayerTiles,
} from './vtStageTaskLayerBuilderHelpers.js';
export { buildLayersWithSingleLayer } from './vtStageTaskLayerBuilderStrategySingleLayer.js';

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

export const buildLayersByContinentGrouping = async (
  context: VTStageContext,
  taskContext: TaskLayerContext,
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  featuresByContinent: Map<string, Feature<Geometry>[]>,
  debugCollect: boolean,
  assertNotAborted: (signal?: AbortSignal) => void,
  vtConfigBoundaryDedupe: boolean,
): Promise<Map<number, Record<string, Tile>>> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const [continent, features] of featuresByContinent.entries()) {
    if (features.length === 0) continue;
    const continentMap = buildLayerMap({ type: 'FeatureCollection', features });
    if (continentMap.size === 0) continue;
    if (debugCollect) {
      console.info('[vt][debug] buildLayerIndexes start', JSON.stringify({
        ...taskContext,
        continent,
        layerCount: continentMap.size,
        heap: null,
      }));
    }
    const continentIndexes = await buildLayerIndexes(context, continentMap, band, {
      ...taskContext,
      continent,
    });
    if (debugCollect) {
      console.info('[vt][debug] buildLayerIndexes done', JSON.stringify({
        ...taskContext,
        continent,
        indexCount: continentIndexes.size,
        heap: null,
      }));
    }
    if (continentIndexes.size === 0) continue;
    for (let z = band.zMin; z <= band.zMax; z++) {
      assertNotAborted(context.abortSignal);
      const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
      for (let x = xStart; x <= xEnd; x++) {
        assertNotAborted(context.abortSignal);
        for (let y = yStart; y <= yEnd; y++) {
          assertNotAborted(context.abortSignal);
          const layers = collectLayersForTileFromIndexes(
            continentIndexes,
            z,
            x,
            y,
            vtConfigBoundaryDedupe,
          );
          if (!layers) continue;
          const tileId = packTileId(x, y, z);
          const existing = aggregatedLayersByTileId.get(tileId);
          if (existing) {
            mergeLayerTiles(existing, layers);
          } else {
            aggregatedLayersByTileId.set(tileId, layers);
          }
        }
      }
    }
  }
  return aggregatedLayersByTileId;
};

export const buildLayersWithPerTileIndex = async (
  context: VTStageContext,
  taskContext: TaskLayerContext,
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  layerMap: Map<string, Feature<Geometry>[]>,
  debugFocusConfig: VtDebugFocusConfig,
  assertNotAborted: (signal?: AbortSignal) => void,
  totalTiles: number,
  intersectingFeatureCount: number,
  buildLayerIndexForTile: BuildLayerIndexForTile,
): Promise<LayerBuildBranchResult> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  const { bufferSize, extent } = context.vtConfig;
  const emptyTilesWithFeatures: GeojsonVtEmptyTileDetail[] = [];
  const featuresWithBBoxByLayer = new Map<string, FeatureWithBBox[]>();
  layerMap.forEach((features, layerName) => {
    const featuresWithBBox = buildFeaturesWithBBox(features);
    if (features.length > 0 && featuresWithBBox.length === 0) {
      console.warn('[vt] layer has features but no bbox', JSON.stringify({
        ...taskContext,
        layerName,
        featureCount: features.length,
      }));
    }
    featuresWithBBoxByLayer.set(layerName, featuresWithBBox);
  });
  for (let z = band.zMin; z <= band.zMax; z++) {
    assertNotAborted(context.abortSignal);
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    for (let x = xStart; x <= xEnd; x++) {
      assertNotAborted(context.abortSignal);
      for (let y = yStart; y <= yEnd; y++) {
        assertNotAborted(context.abortSignal);
        const tileBBox = expandTileBBox(
          tileToBBox(z, x, y),
          bufferSize,
          extent,
        );
        const layersForTile: Record<string, Tile> = {};
        for (const [layerName, featuresWithBBox] of featuresWithBBoxByLayer.entries()) {
          if (featuresWithBBox.length === 0) continue;
          const clippedFeatures = clipFeaturesForTile(featuresWithBBox, tileBBox);
          if (clippedFeatures.length === 0) continue;
          const tileKey = `${z}/${x}/${y}`;
          const clippedFeatureIds = debugFocusConfig.enabled
            ? collectUniqueFeatureIds(clippedFeatures)
            : [];
          const debugFocusMatch = debugFocusConfig.enabled
            ? resolveVtDebugFocusMatch(debugFocusConfig, tileKey, clippedFeatureIds)
            : {
              shouldLog: false,
              tileMatched: false,
              featureMatched: false,
              matchedFeatureIds: [],
            };
          if (debugFocusMatch.shouldLog) {
            console.info('[vt][focus] per-tile layer input', JSON.stringify({
              ...taskContext,
              parentTile: parent,
              tile: { z, x, y },
              layerName,
              featureCount: featuresWithBBox.length,
              clippedFeatureCount: clippedFeatures.length,
              tileMatched: debugFocusMatch.tileMatched,
              featureMatched: debugFocusMatch.featureMatched,
              matchedFeatureIds: debugFocusMatch.matchedFeatureIds,
            }));
          }
          const tile = await buildLayerIndexForTile(layerName, clippedFeatures, z, x, y);
          if (!tile) {
            const detail: GeojsonVtEmptyTileDetail = {
              z,
              x,
              y,
              layerName,
              clippedFeatureCount: clippedFeatures.length,
              featureCount: featuresWithBBox.length,
              ...(debugFocusMatch.matchedFeatureIds.length > 0
                ? { matchedFeatureIds: debugFocusMatch.matchedFeatureIds }
                : {}),
            };
            emptyTilesWithFeatures.push(detail);
            if (debugFocusMatch.shouldLog) {
              console.warn('[vt][focus] geojson-vt empty tile', JSON.stringify({
                ...taskContext,
                parentTile: parent,
                tile: { z, x, y },
                layerName,
                clippedFeatureCount: clippedFeatures.length,
                featureCount: featuresWithBBox.length,
                matchedFeatureIds: debugFocusMatch.matchedFeatureIds,
              }));
            }
            continue;
          }
          layersForTile[layerName] = tile;
        }
        if (Object.keys(layersForTile).length === 0) continue;
        const tileId = packTileId(x, y, z);
        aggregatedLayersByTileId.set(tileId, layersForTile);
      }
    }
  }
  if (aggregatedLayersByTileId.size === 0) {
    const layerStats = Array.from(layerMap.entries()).map(([layerName, features]) => ({
      layerName,
      featureCount: features.length,
      featuresWithBBox: featuresWithBBoxByLayer.get(layerName)?.length ?? 0,
    }));
    console.warn('[vt] per-tile index produced no layers', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      zRange: [band.zMin, band.zMax],
      totalTiles,
      layerCount: layerMap.size,
      intersectingFeatureCount,
      layerStats,
    }));
    return { aggregatedLayersByTileId, indexes: null };
  }
  if (emptyTilesWithFeatures.length > 0) {
    const firstEmptyTileDetail = emptyTilesWithFeatures[0];
    const emptyTileReason = firstEmptyTileDetail
      ? buildGeojsonVtEmptyTileSummaryReason(emptyTilesWithFeatures.length, firstEmptyTileDetail)
      : 'geojson-vt produced empty tile for clipped features';
    console.warn('[vt] geojson-vt produced empty tile for clipped features', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      zRange: [band.zMin, band.zMax],
      totalTiles,
      emptyTileCount: emptyTilesWithFeatures.length,
      firstEmptyTile: firstEmptyTileDetail,
      sampleEmptyTiles: emptyTilesWithFeatures.slice(0, GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT),
    }));
    if (debugFocusConfig.enabled && firstEmptyTileDetail) {
      console.warn('[vt][focus] empty tile summary', JSON.stringify({
        ...taskContext,
        parentTile: parent,
        reason: emptyTileReason,
        sampleEmptyTiles: emptyTilesWithFeatures.slice(0, GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT),
      }));
    }
  }
  return { aggregatedLayersByTileId, indexes: null };
};

export const buildLayersWithMultipleLayers = async (
  context: VTStageContext,
  taskContext: TaskLayerContext,
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  layerMap: Map<string, Feature<Geometry>[]>,
  debugCollect: boolean,
  assertNotAborted: (signal?: AbortSignal) => void,
  vtConfigBoundaryDedupe: boolean,
): Promise<Map<number, Record<string, Tile>>> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const [layerName, features] of layerMap.entries()) {
    if (features.length === 0) continue;
    assertNotAborted(context.abortSignal);
    const singleLayerMap = new Map<string, Feature<Geometry>[]>([[layerName, features]]);
    if (debugCollect) {
      console.info('[vt][debug] buildLayerIndexes start', JSON.stringify({
        ...taskContext,
        layerCount: singleLayerMap.size,
        layerName,
        heap: null,
      }));
    }
    const layerIndexes = await buildLayerIndexes(context, singleLayerMap, band, taskContext);
    if (debugCollect) {
      console.info('[vt][debug] buildLayerIndexes done', JSON.stringify({
        ...taskContext,
        layerName,
        indexCount: layerIndexes.size,
        heap: null,
      }));
    }
    const layerIndex = layerIndexes.get(layerName);
    if (!layerIndex) continue;
    for (let z = band.zMin; z <= band.zMax; z++) {
      assertNotAborted(context.abortSignal);
      const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
      for (let x = xStart; x <= xEnd; x++) {
        assertNotAborted(context.abortSignal);
        for (let y = yStart; y <= yEnd; y++) {
          assertNotAborted(context.abortSignal);
          const tile = collectLayerForTile(layerIndex, layerName, z, x, y, vtConfigBoundaryDedupe);
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
  return aggregatedLayersByTileId;
};
