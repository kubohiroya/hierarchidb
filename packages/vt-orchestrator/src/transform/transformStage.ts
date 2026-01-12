import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import type { StageHandler, StageHandlerResult } from '../runner.js';
import type { TransformByBandTaskInput, TransformByBandStageContext } from '../types.js';
import { simplifyFeatureCollection, buildBoundaryFeature } from './geometry.js';
import { putTransformByBandCache } from '@hierarchidb/vt-shape-store';

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decodeFetchCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  const { shapeStore, transformConfig, bands } = context;
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: task input is missing' };
    }
    const band = bandMap.get(input.bandId);
    if (!band) {
      return { status: 'failed', errorMessage: `transform-by-band failed: unknown bandId (${input.bandId})` };
    }

    const fetchCache = await shapeStore.fetchCache.get(input.fetchCacheId);
    if (!fetchCache) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: fetch cache not found' };
    }

    const collection = await decodeFetchCache(fetchCache.data);
    if (!collection || collection.features.length === 0) {
      return { status: 'failed', errorMessage: 'transform-by-band failed: empty fetch cache' };
    }

    const inputFeatureCount = collection.features.length;
    const inputMissingGeometry = collection.features.filter((feature) => !feature?.geometry).length;
    const inputPolygonCount = collection.features.reduce(
      (sum, feature) => sum + countPolygonsFromGeometry(feature?.geometry),
      0,
    );
    let simplified: FeatureCollection;
    try {
      simplified = simplifyFeatureCollection(collection, band.zMax, transformConfig.toleranceK);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      let errorFeatureCount = 0;
      let errorPolygonCount = 0;
      for (const feature of collection.features) {
        if (!feature?.geometry) continue;
        try {
          simplifyFeatureCollection({ type: 'FeatureCollection', features: [feature] }, band.zMax, transformConfig.toleranceK);
        } catch {
          errorFeatureCount += 1;
          errorPolygonCount += countPolygonsFromGeometry(feature.geometry);
        }
      }
      return {
        status: 'failed',
        errorMessage: `transform-by-band failed: geometry simplify error (extract1/${band.zMax}) (${err}) (features=${errorFeatureCount}/${inputFeatureCount}, polygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry})`,
      };
    }
    if (simplified.features.length === 0) {
      return {
        status: 'failed',
        errorMessage: `transform-by-band failed: simplified features empty (features=${inputFeatureCount}, polygons=${inputPolygonCount}, missingGeometry=${inputMissingGeometry})`,
      };
    }

    const adminLevel = input.adminLevel;
    const layerName = typeof adminLevel === 'number' ? `admin${adminLevel}` : 'admin0';
    const boundaryLayerName = typeof adminLevel === 'number'
      ? `admin${adminLevel}-boundary`
      : 'admin0-boundary';

    const features: Feature[] = [];
    for (let index = 0; index < simplified.features.length; index++) {
      const feature = simplified.features[index];
      if (!feature) continue;
      const properties = {
        ...(feature.properties ?? {}),
        layer: layerName,
        level: adminLevel,
      } as Record<string, unknown> & { id?: string };
      const id = properties.id ?? `${input.sourceKey}:${index}`;
      properties.id = id;
      const featureWithId = { ...feature, id, properties };
      features.push(featureWithId);
      features.push(buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel));
    }

    const outputCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const vertexCount = features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0);
    const polygonCount = features.reduce((sum, feature) => sum + countPolygonsFromGeometry(feature.geometry), 0);
    const encoded = await encodeFlatGeobufFromFeatureCollection(outputCollection);

    await putTransformByBandCache(shapeStore, task.nodeId, input.bandId, {
      sourceKey: input.sourceKey,
      countryCode: input.countryCode,
      adminLevel: input.adminLevel,
      data: encoded,
      featureCount: features.length,
      vertexCount,
      polygonCount,
    });

    return { status: 'completed', progress: 100 };
  };
};
