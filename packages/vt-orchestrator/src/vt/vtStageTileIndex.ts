import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { BandConfig } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import type { Topology } from 'topojson-specification';
import { quantizeTopoJsonToGrid } from '~/transform/topojsonGrid';
import { getTopojsonRuntime } from '~/transform/topojsonRuntimeAdapter';
import { countVerticesFromGeometry, resolveMaxVerticesPerTile } from './vtStageGeometry.js';

export type GeojsonVtIndex = { getTile: (z: number, x: number, y: number) => Tile | null };

export const buildTileLayerIndexFromFeatures = async (params: {
  layerName: string;
  features: Feature<Geometry>[];
  z: number;
  x: number;
  y: number;
  context: VTStageContext;
  geojsonVt: (collection: FeatureCollection, options: {
    maxZoom: number;
    indexMaxZoom: number;
    extent: number;
    buffer: number;
    tolerance: number;
    promoteId: string;
    indexMaxPoints: number;
  }) => GeojsonVtIndex;
  topojsonSimplify?: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  };
  debugCollect?: boolean;
}): Promise<Tile | null> => {
  if (params.features.length === 0) return null;
  const maxVerticesPerTile = resolveMaxVerticesPerTile(params.context.vtConfig.indexMaxPoints);
  let collection: FeatureCollection = { type: 'FeatureCollection', features: params.features };
  if (params.topojsonSimplify?.enabled) {
    const simplifyResult = await simplifyTileFeatureCollectionWithTopojson({
      collection,
      zTarget: params.z,
      toleranceK: params.topojsonSimplify.toleranceK,
      retryToleranceStep: params.topojsonSimplify.retryToleranceStep,
      maxVerticesPerTile,
      quantize: params.topojsonSimplify.quantize,
      extent: params.context.vtConfig.extent,
      onAttempt: (attempt, toleranceK, maxVertices) => {
        if (params.debugCollect) {
          const details = {
            tile: `${params.z}/${params.x}/${params.y}`,
            layerName: params.layerName,
            attempt,
            attemptToleranceK: toleranceK,
            attemptMaxVertices: maxVertices,
            targetMaxVertices: maxVerticesPerTile,
          };
          console.info('[vt][debug] topojson simplify attempt', JSON.stringify(details));
        }
      },
    });
    collection = simplifyResult.collection;
  }

  const index = params.geojsonVt(collection, {
    maxZoom: params.z,
    indexMaxZoom: params.z,
    extent: params.context.vtConfig.extent,
    buffer: params.context.vtConfig.bufferSize,
    tolerance: params.topojsonSimplify?.enabled ? 0 : params.context.vtConfig.tolerance,
    promoteId: params.context.vtConfig.promoteId,
    indexMaxPoints: maxVerticesPerTile,
  }) as GeojsonVtIndex;

  const indexedTile = index.getTile(params.z, params.x, params.y);
  if (!indexedTile || !Array.isArray(indexedTile.features) || indexedTile.features.length === 0) return null;
  return indexedTile as Tile;
};

const EARTH_RADIUS_METERS = 6_378_137;
const DEFAULT_MVT_EXTENT = 4096;

export const resolveTopojsonToleranceDegrees = (
  zTarget: number,
  toleranceK: number,
  extent: number,
): number => {
  const resolvedExtent = Number.isFinite(extent) && extent > 0 ? extent : DEFAULT_MVT_EXTENT;
  if (!Number.isFinite(zTarget) || !Number.isFinite(toleranceK) || zTarget < 0) return 0;
  return toleranceK * (2 * Math.PI * EARTH_RADIUS_METERS) / (resolvedExtent * 2 ** zTarget);
};

export const maxVerticesInCollection = (collection: FeatureCollection): number => {
  return collection.features.reduce((maxVertices, feature) => {
    const featureVertices = countVerticesFromGeometry(feature.geometry);
    return featureVertices > maxVertices ? featureVertices : maxVertices;
  }, 0);
};

type TopologySimplifyResult = {
  collection: FeatureCollection;
  finalToleranceK: number;
  attempts: number;
};

export const simplifyTileFeatureCollectionWithTopojson = async (params: {
  collection: FeatureCollection;
  zTarget: number;
  toleranceK: number;
  retryToleranceStep: number;
  maxVerticesPerTile: number;
  extent: number;
  quantize?: number;
  maxAttempts?: number;
  onAttempt?: (attempt: number, toleranceK: number, maxVertices: number) => void;
}): Promise<TopologySimplifyResult> => {
  if (params.collection.features.length === 0) {
    return {
      collection: params.collection,
      finalToleranceK: params.toleranceK,
      attempts: 0,
    };
  }

  const featureCount = params.collection.features.length;
  if (!Number.isFinite(params.toleranceK) || params.toleranceK <= 0 || featureCount === 0 || params.maxVerticesPerTile <= 0) {
    return {
      collection: params.collection,
      finalToleranceK: params.toleranceK,
      attempts: 1,
    };
  }

  const configuredMaxAttempts = params.maxAttempts ?? 12;
  const maxAttempts = Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts > 0
    ? Math.min(32, Math.round(configuredMaxAttempts))
    : 12;

  const retryStep = Number.isFinite(params.retryToleranceStep) && params.retryToleranceStep > 0
    ? params.retryToleranceStep
    : 0;

  const runtime = await getTopojsonRuntime();
  let topology = runtime.topology({ collection: params.collection as unknown as Record<string, unknown> });

  const configuredQuantize = params.quantize ?? 0;
  if (Number.isFinite(configuredQuantize) && configuredQuantize > 0) {
    topology = await quantizeTopoJsonToGrid(topology, {
      zTarget: params.zTarget,
      quantize: configuredQuantize,
    });
  }

  const presimplified = runtime.presimplify(topology);
  const objectEntry = Object
    .entries(topology.objects ?? {})
    .find(([key]) => Boolean(key));
  const objectKey = objectEntry?.[0];
  const objectGeometry = objectEntry?.[1];
  if (!objectKey || !objectGeometry) {
    return {
      collection: params.collection,
      finalToleranceK: params.toleranceK,
      attempts: 1,
    };
  }

  let bestCollection = params.collection;
  let currentToleranceK = params.toleranceK;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tolerance = resolveTopojsonToleranceDegrees(params.zTarget, currentToleranceK, params.extent);
    const simplifiedTopology = tolerance > 0
      ? runtime.simplify(presimplified, tolerance)
      : topology;
    const geojson = runtime.feature(simplifiedTopology, objectGeometry as Topology['objects'][string]) as FeatureCollection | Feature<Geometry>;
    const nextCollection = geojson.type === 'FeatureCollection'
      ? { ...geojson, features: Array.isArray(geojson.features) ? geojson.features : [] }
      : { type: 'FeatureCollection' as const, features: [geojson] };
    const maxVertices = maxVerticesInCollection(nextCollection);
    params.onAttempt?.(attempt, currentToleranceK, maxVertices);
    bestCollection = nextCollection;
    if (maxVertices <= params.maxVerticesPerTile || retryStep <= 0) {
      return {
        collection: nextCollection,
        finalToleranceK: currentToleranceK,
        attempts: attempt,
      };
    }
    currentToleranceK += retryStep;
  }

  return {
    collection: bestCollection,
    finalToleranceK: currentToleranceK,
    attempts: maxAttempts,
  };
};

export const buildLayerIndexes = async (
  context: VTStageContext,
  layers: Map<string, Feature[]>,
  band: BandConfig,
  debugContext?: {
    taskId: string;
    nodeId: string;
    bandIndex?: number | null;
    tileId?: number | null;
    continent?: string;
  },
): Promise<Map<string, GeojsonVtIndex>> => {
  const geojsonvt = await import('geojson-vt');
  const candidate = geojsonvt as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  const instance = candidate.default ?? candidate;
  const indexes = new Map<string, GeojsonVtIndex>();
  const startAt = Date.now();
  if (debugContext) {
    console.info('[vt] index build start', JSON.stringify({
      ...debugContext,
      layerCount: layers.size,
      featureCount: Array.from(layers.values()).reduce((sum, features) => sum + features.length, 0),
      zRange: [band.zMin, band.zMax],
    }));
  }
  for (const [layerName, features] of layers.entries()) {
    if (features.length === 0) continue;

    //if ( > 0 && !vtConfig.layers.includes(layerName)) continue;
    //if (vtConfig.layers.length > 0 && !vtConfig.layers.includes(layerName)) continue;
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const index = instance(collection, {
      maxZoom: band.zMax,
      indexMaxZoom: band.zMax,
      extent: context.vtConfig.extent,
      buffer: context.vtConfig.bufferSize,
      tolerance: context.vtConfig.tolerance,
      promoteId: context.vtConfig.promoteId,
      indexMaxPoints: resolveMaxVerticesPerTile(context.vtConfig.indexMaxPoints),
    });
    indexes.set(layerName, index as unknown as GeojsonVtIndex);
  }
  if (debugContext) {
    console.info('[vt] index build done', JSON.stringify({
      ...debugContext,
      indexCount: indexes.size,
      duration: Date.now() - startAt,
    }));
  }
  return indexes;
};
