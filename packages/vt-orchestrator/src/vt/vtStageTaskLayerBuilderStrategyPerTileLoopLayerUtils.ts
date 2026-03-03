import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import type { TileBBox } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import {
  clipFeaturesForTile,
} from './vtStageGeometryClipping.js';
import { buildFeaturesWithBBox, type FeatureWithBBox } from './vtStageGeometryFeature.js';
import { collectUniqueFeatureIds } from './vtStageFeatureMetadata.js';
import { resolveVtDebugFocusMatch } from './vtStageDebug.js';
import type { GeojsonVtEmptyTileDetail } from './vtStageSummary.js';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

export type PerTileLayerFeatureMap = Map<string, FeatureWithBBox[]>;

type LayerPrecomputeInput = {
  layerMap: Map<string, Feature<Geometry>[]>;
  taskContext: TaskLayerContext;
};

export const buildFeaturesWithBBoxByLayer = (
  { layerMap, taskContext }: LayerPrecomputeInput,
): PerTileLayerFeatureMap => {
  const featuresWithBBoxByLayer = new Map<string, FeatureWithBBox[]>();
  for (const [layerName, features] of layerMap.entries()) {
    const featuresWithBBox = buildFeaturesWithBBox(features);
    if (features.length > 0 && featuresWithBBox.length === 0) {
      console.warn('[tileEmit] layer has features but no bbox', JSON.stringify({
        ...taskContext,
        layerName,
        featureCount: features.length,
      }));
    }
    featuresWithBBoxByLayer.set(layerName, featuresWithBBox);
  }
  return featuresWithBBoxByLayer;
};

type ResolveTileLayerInput = {
  context: TaskLayerContext;
  tileKey: string;
  parent: { z: number; x: number; y: number };
  layerName: string;
  featuresWithBBox: FeatureWithBBox[];
  tileBBox: TileBBox;
  z: number;
  x: number;
  y: number;
  buildLayerIndexForTile: (layerName: string, features: Feature<Geometry>[], z: number, x: number, y: number) => Promise<Tile | null>;
  debugFocusConfig: VtDebugFocusConfig;
};

export type PerTileLayerContribution = {
  tile: Tile | null;
  emptyTileDetail: GeojsonVtEmptyTileDetail | null;
};

export const resolvePerTileLayerContribution = async ({
  context,
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
}: ResolveTileLayerInput): Promise<PerTileLayerContribution> => {
  const clippedFeatures = clipFeaturesForTile(featuresWithBBox, tileBBox);
  if (clippedFeatures.length === 0) {
    return { tile: null, emptyTileDetail: null };
  }

  const clippedFeatureIds = debugFocusConfig.enabled
    ? collectUniqueFeatureIds(clippedFeatures)
    : [];
  const debugFocusMatch = debugFocusConfig.enabled
    ? resolveVtDebugFocusMatch(debugFocusConfig, tileKey, clippedFeatureIds as string[])
    : {
      shouldLog: false,
      tileMatched: false,
      featureMatched: false,
      matchedFeatureIds: [],
    };

  if (debugFocusMatch.shouldLog) {
    console.info('[tileEmit][focus] per-tile layer input', JSON.stringify({
      ...context,
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

  const tile = await buildLayerIndexForTile(layerName, clippedFeatures as Feature<Geometry>[], z, x, y);
  if (tile) {
    return { tile, emptyTileDetail: null };
  }

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
  if (debugFocusMatch.shouldLog) {
    console.warn('[tileEmit][focus] geojson-vt empty tile', JSON.stringify({
      ...context,
      parentTile: parent,
      tile: { z, x, y },
      layerName,
      clippedFeatureCount: clippedFeatures.length,
      featureCount: featuresWithBBox.length,
      matchedFeatureIds: debugFocusMatch.matchedFeatureIds,
    }));
  }

  return { tile: null, emptyTileDetail: detail };
};
