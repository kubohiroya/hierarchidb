import type {
  Feature,
  Geometry,
} from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import type { BandConfig, StageHandlerResult } from '~/types/types';
import {
  assertNotAborted,
} from './vtStageCore.js';
import type {
  GeojsonVtIndex,
} from './vtStageTileIndex.js';
import { loadGeojsonVt } from './vtStageFeatureCollector.js';
import {
  buildLayerMap,
  type InputFeatureStats,
} from './vtStageGeometry.js';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import {
  buildLayersByContinentGrouping,
  buildLayersWithMultipleLayers,
  buildLayersWithPerTileIndex,
  buildLayersWithSingleLayer,
} from './vtStageTaskLayerBuilderStrategies.js';
import { createLayerIndexForTile } from './vtStageTaskLayerBuilderHelpers.js';

type TaskLayerContext = {
  taskId: string;
  nodeId: string;
  bandIndex?: number;
  tileId: number;
  bufferCount: number;
};

export type VtLayerBuildResult = {
  kind: 'ready';
  aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null;
  indexes: Map<string, GeojsonVtIndex> | null;
} | {
  kind: 'skipped';
  result: StageHandlerResult;
};

type VtLayerBuildInput = {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: {
    z: number;
    x: number;
    y: number;
  };
  collection: {
    type: 'FeatureCollection';
    features: Feature<Geometry>[];
  };
  featuresByContinent?: Map<string, Feature<Geometry>[]> | undefined;
  featureStats: InputFeatureStats[];
  debugCollect: boolean;
  debugFocusConfig: VtDebugFocusConfig;
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  } | null;
  totalTiles: number;
  intersectingFeatureCount: number;
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
};

export const buildLayersForVtTask = async (input: VtLayerBuildInput): Promise<VtLayerBuildResult> => {
  const {
    context,
    taskContext,
    band,
    parent,
    collection,
    featuresByContinent,
    featureStats,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    totalTiles,
    intersectingFeatureCount,
    completedWithParentInputSummary,
  } = input;

  const { vtConfig } = context;
  const completed = (reason: string): StageHandlerResult => completedWithParentInputSummary(reason);

  console.info('[vt] tiling start', JSON.stringify({
    ...taskContext,
    zRange: [band.zMin, band.zMax],
    totalTiles,
    parentTile: parent,
    heap: null,
  }));
  if (totalTiles === 0) {
    return {
      kind: 'skipped',
      result: completed('no tiles'),
    };
  }

  if (intersectingFeatureCount === 0) {
    const sample = featureStats.slice(0, 3).map((stats) => ({
      bbox: stats.bbox,
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      lineStringCount: stats.lineStringCount,
      bufferId: stats.bufferId,
      featureId: stats.featureId,
      geojsonByteSize: stats.geojsonByteSize,
    }));
    console.warn('[vt] no intersecting features for parent tile', JSON.stringify({
      ...taskContext,
      parentTile: parent,
      totalFeatures: collection.features.length,
      featureStatsCount: featureStats.length,
      sample,
    }));
    return {
      kind: 'skipped',
      result: completed('no intersecting features for parent tile'),
    };
  }

  const geojsonvt = await loadGeojsonVt();
  const buildLayerIndexForTile = createLayerIndexForTile({
    context,
    geojsonVt: geojsonvt,
    useTopojsonTileSimplify,
    topojsonSimplify,
    debugCollect,
  });

  let indexes: Map<string, GeojsonVtIndex> | null = null;
  let aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null = null;
  if (!useTopojsonTileSimplify && groupByContinent && featuresByContinent && featuresByContinent.size > 1) {
    aggregatedLayersByTileId = await buildLayersByContinentGrouping(
      context,
      taskContext,
      band,
      parent,
      featuresByContinent,
      debugCollect,
      assertNotAborted,
      vtConfig.boundaryDedupe,
    );
    if (aggregatedLayersByTileId.size === 0) {
      console.warn('[vt] no layers after continent grouping', JSON.stringify({
        ...taskContext,
        parentTile: parent,
        zRange: [band.zMin, band.zMax],
        totalTiles,
        continentCount: featuresByContinent?.size ?? 0,
      }));
      return {
        kind: 'skipped',
        result: completed('no layers'),
      };
    }
  } else {
    const layerMap = buildLayerMap(collection);
    if (layerMap.size === 0) {
      return {
        kind: 'skipped',
        result: completed('no layers'),
      };
    }
    const forcePerTileIndex = useTopojsonTileSimplify || band.zMin >= 3;
    if (forcePerTileIndex) {
      const branchResult = await buildLayersWithPerTileIndex(
        context,
        taskContext,
        band,
        parent,
        layerMap,
        debugFocusConfig,
        assertNotAborted,
        totalTiles,
        intersectingFeatureCount,
        buildLayerIndexForTile,
      );
      indexes = branchResult.indexes;
      aggregatedLayersByTileId = branchResult.aggregatedLayersByTileId;
      if (!aggregatedLayersByTileId || aggregatedLayersByTileId.size === 0) {
        return {
          kind: 'skipped',
          result: completed('no layers'),
        };
      }
    } else if (layerMap.size === 1) {
      const branchResult = await buildLayersWithSingleLayer(
        context,
        taskContext,
        band,
        parent,
        layerMap,
        debugCollect,
        assertNotAborted,
        buildLayerIndexForTile,
      );
      indexes = branchResult.indexes;
      aggregatedLayersByTileId = branchResult.aggregatedLayersByTileId;
      if (!aggregatedLayersByTileId) {
        if (!indexes || indexes.size === 0) {
          return {
            kind: 'skipped',
            result: completed('no layers'),
          };
        }
      } else if (aggregatedLayersByTileId.size === 0) {
        return {
          kind: 'skipped',
          result: completed('no layers'),
        };
      }
    } else {
      aggregatedLayersByTileId = await buildLayersWithMultipleLayers(
        context,
        taskContext,
        band,
        parent,
        layerMap,
        debugCollect,
        assertNotAborted,
        vtConfig.boundaryDedupe,
      );
      if (aggregatedLayersByTileId.size === 0) {
        console.warn('[vt] multi-layer index produced no layers', JSON.stringify({
          ...taskContext,
          parentTile: parent,
          zRange: [band.zMin, band.zMax],
          layerCount: layerMap.size,
        }));
        return {
          kind: 'skipped',
          result: completed('no layers'),
        };
      }
    }
  }
  return {
    kind: 'ready',
    aggregatedLayersByTileId,
    indexes,
  };
};
