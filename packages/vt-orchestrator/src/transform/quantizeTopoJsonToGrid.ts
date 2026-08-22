import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import { snapGeometryToGrid } from './geometryTransformUtils.js';
import { getTopojsonRuntime } from './topojsonRuntimeAdapter.js';

type ZoomGridConfig = {
  zTarget: number;
  quantize?: number;
};

const normalizeFeatureCollection = (value: FeatureCollection | Feature): FeatureCollection => {
  if (value.type === 'FeatureCollection') {
    const features = Array.isArray(value.features) ? value.features : [];
    return { ...value, features };
  }
  return { type: 'FeatureCollection', features: [value] };
};

const snapFeatureCollectionToGrid = (
  collection: FeatureCollection,
  config: ZoomGridConfig
): FeatureCollection => {
  const snapped = collection.features.map((feature) => {
    if (!feature?.geometry) return feature;
    const geometry = snapGeometryToGrid(
      feature.geometry,
      config.zTarget,
      config.quantize
    ) as Geometry;
    return { ...feature, geometry };
  });
  return { ...collection, features: snapped };
};

export const quantizeTopoJsonToGrid = async (
  topology: Topology,
  config: ZoomGridConfig
): Promise<Topology> => {
  const objects = topology.objects ?? {};
  const entries = Object.entries(objects);
  if (entries.length === 0) return topology;

  const runtime = await getTopojsonRuntime();
  const snappedObjects: Record<string, FeatureCollection> = {};
  for (const [key, object] of entries) {
    if (!object) continue;
    const geojson = runtime.feature(topology, object) as FeatureCollection | Feature;
    const collection = normalizeFeatureCollection(geojson);
    const snapped = snapFeatureCollectionToGrid(collection, config);
    snappedObjects[key] = snapped;
  }

  if (Object.keys(snappedObjects).length === 0) {
    return topology;
  }

  return runtime.topology(snappedObjects);
};
