const layerBuildExecutionModes = [
  'buildByContinentGrouping',
  'buildPerTile',
  'buildSingleLayer',
  'buildMultiLayer',
] as const;

const layerBuildSkipModes = ['skipNoTiles', 'skipNoIntersectingFeatures', 'skipNoLayers'] as const;

export const layerBuildSkipReason = {
  noTiles: 'no tiles',
  noIntersectingFeatures: 'no intersecting features for parent tile',
  noLayers: 'no layers',
} as const;

export type LayerBuildExecutionMode = (typeof layerBuildExecutionModes)[number];
export type LayerBuildSkipMode = (typeof layerBuildSkipModes)[number];
export type LayerBuildMode = LayerBuildExecutionMode | LayerBuildSkipMode;

export const isLayerBuildExecutionMode = (mode: LayerBuildMode): mode is LayerBuildExecutionMode =>
  layerBuildExecutionModes.includes(mode as LayerBuildExecutionMode);

export const isLayerBuildSkipMode = (mode: LayerBuildMode): mode is LayerBuildSkipMode =>
  layerBuildSkipModes.includes(mode as LayerBuildSkipMode);

export type LayerBuildPolicy = {
  mode: LayerBuildMode;
  skipReason?: string;
};

export type LayerBuildPolicyInput = {
  totalTiles: number;
  intersectingFeatureCount: number;
  useTopojsonTileSimplify: boolean;
  bandZMin: number;
  featureLayerCount: number;
  groupByContinent: boolean;
  continentCount: number;
};

export const decideLayerBuildPolicy = (input: LayerBuildPolicyInput): LayerBuildPolicy => {
  const {
    totalTiles,
    intersectingFeatureCount,
    useTopojsonTileSimplify,
    bandZMin,
    featureLayerCount,
    groupByContinent,
    continentCount,
  } = input;

  if (totalTiles === 0) {
    return { mode: 'skipNoTiles', skipReason: layerBuildSkipReason.noTiles };
  }

  if (intersectingFeatureCount === 0) {
    return {
      mode: 'skipNoIntersectingFeatures',
      skipReason: layerBuildSkipReason.noIntersectingFeatures,
    };
  }

  if (!useTopojsonTileSimplify && groupByContinent && continentCount > 1) {
    return { mode: 'buildByContinentGrouping' };
  }

  if (featureLayerCount === 0) {
    return { mode: 'skipNoLayers', skipReason: layerBuildSkipReason.noLayers };
  }

  if (useTopojsonTileSimplify || bandZMin >= 3) {
    return { mode: 'buildPerTile' };
  }

  if (featureLayerCount === 1) {
    return { mode: 'buildSingleLayer' };
  }

  return { mode: 'buildMultiLayer' };
};
