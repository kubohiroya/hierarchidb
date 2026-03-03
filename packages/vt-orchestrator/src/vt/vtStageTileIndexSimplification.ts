import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import { quantizeTopoJsonToGrid } from '~/transform/quantizeTopoJsonToGrid';
import { getTopojsonRuntime } from '~/transform/topojsonRuntimeAdapter';
import { countVerticesFromGeometry } from './vtStageGeometryCounts.js';

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
  const topologyInput: Record<string, unknown> = { collection: params.collection };
  let topology = runtime.topology(topologyInput);

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
