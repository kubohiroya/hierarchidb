import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { topology } from 'topojson-server';
import { feature as topojsonFeature } from 'topojson-client';
import { presimplify as preextract, simplify as extractTopology } from 'topojson-simplify';

type ExtractTopoOptions = {
  tolerance: number;
  quantize?: number;
};

const quantizeCoordinates = <T>(coords: T, quantize: number): T => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    return (coords as number[]).map((value) => Math.round(value * quantize) / quantize) as unknown as T;
  }
  return (coords as unknown[]).map((child) => quantizeCoordinates(child, quantize)) as unknown as T;
};

const applyQuantize = (feature: Feature, quantize?: number): Feature => {
  if (!quantize || quantize <= 0 || !feature.geometry) return feature;
  if (feature.geometry.type === 'GeometryCollection') return feature;
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: quantizeCoordinates(feature.geometry.coordinates, quantize),
    } as Geometry,
  };
};

const collectFeatures = (result: ReturnType<typeof topojsonFeature>): Feature[] => {
  if (result.type === 'FeatureCollection' && Array.isArray(result.features)) {
    return result.features as Feature[];
  }
  return [result as Feature];
};

export const extractTopoJsonByTiles = (
  collection: FeatureCollection,
  options: ExtractTopoOptions,
): FeatureCollection => {
  const topo = topology({
    collection: {
      type: 'FeatureCollection',
      features: collection.features,
    } as FeatureCollection,
  });
  const preextracted = preextract(topo);
  const extracted = Number.isFinite(options.tolerance) && options.tolerance > 0
    ? extractTopology(preextracted, options.tolerance)
    : preextracted;
  const restored = topojsonFeature(
    extracted,
    extracted.objects.collection as typeof extracted.objects[keyof typeof extracted.objects],
  );
  const results = collectFeatures(restored).map((entry) => applyQuantize(entry, options.quantize));
  return {
    type: 'FeatureCollection',
    features: results,
  };
};
