import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

export interface ExtractOptions {
  tolerance: number;
  perFeature: boolean;
  quantize?: number;
}

const extractFeature = (
  feature: Feature<Geometry, GeoJsonProperties>,
  tolerance: number,
): Feature<Geometry, GeoJsonProperties> => {
  if (!feature.geometry) return feature;
  const extracted = turf.simplify(feature, { tolerance, highQuality: false, mutate: false });
  return extracted as Feature<Geometry, GeoJsonProperties>;
};

const quantizeCoordinates = <T>(coords: T, quantize: number): T => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    return (coords as number[]).map((value) => Math.round(value * quantize) / quantize) as unknown as T;
  }
  return (coords as unknown[]).map((child) => quantizeCoordinates(child, quantize)) as unknown as T;
};

const quantizeGeometryObject = (geometry: Geometry, quantize: number): Geometry => {
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries.map((child) => quantizeGeometryObject(child, quantize)),
    };
  }
  const coordinates = quantizeCoordinates(geometry.coordinates, quantize) as typeof geometry.coordinates;
  return {
    ...geometry,
    coordinates,
  } as Geometry;
};

const quantizeGeometry = (
  feature: Feature<Geometry, GeoJsonProperties>,
  quantize?: number,
): Feature<Geometry, GeoJsonProperties> => {
  if (!feature.geometry || !quantize || quantize <= 0) return feature;
  return {
    ...feature,
    geometry: quantizeGeometryObject(feature.geometry, quantize),
  };
};

export const extractGeoJson = (geojson: unknown, options: ExtractOptions): unknown => {
  if (!geojson || typeof geojson !== 'object') return geojson;

  const collection = geojson as FeatureCollection;
  if (collection.type === 'FeatureCollection' && Array.isArray(collection.features)) {
    if (!options.perFeature) return geojson;
    return {
      ...collection,
      features: collection.features.map((feature) => {
        const needsExtract = Number.isFinite(options.tolerance) && options.tolerance > 0;
        try {
          const extracted = needsExtract
            ? extractFeature(feature as Feature<Geometry>, options.tolerance)
            : (feature as Feature<Geometry>);
          return quantizeGeometry(extracted, options.quantize);
        } catch {
          return feature as Feature<Geometry>;
        }
      }),
    } satisfies FeatureCollection;
  }

  return geojson;
};
