import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import { getTilesInBounds, type BoundingBox } from '@hierarchidb/gis-sdk';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import type { StageHandler, StageHandlerResult } from '../runner.js';
import type { TransformTaskInput, TransformStageConfig, BandConfig, TransformStageContext } from '../types.js';
import { simplifyFeatureCollection, buildBoundaryFeature } from './geometry.js';
import { packTileId } from '../tiles/tileId.js';

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

const decodeStage1Buffer = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
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

const loadGeojsonVt = async () => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};

const buildTileIndex = async (
  collection: FeatureCollection,
  band: BandConfig,
  indexConfig: TransformStageConfig['tileIndex'],
): Promise<{ tileIdSet: Set<number> }> => {
  const zBase = band.zBase;
  const geojsonvt = await loadGeojsonVt();
  const index = geojsonvt(collection, {
    maxZoom: zBase,
    indexMaxZoom: zBase,
    buffer: indexConfig.buffer,
    extent: indexConfig.extent,
    promoteId: indexConfig.promoteId ?? 'id',
  });
  let bbox: BoundingBox | null = null;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    try {
      const box = turfBbox(feature as Feature) as BoundingBox;
      if (box.every((value) => Number.isFinite(value))) {
        if (!bbox) {
          bbox = [box[0], box[1], box[2], box[3]];
        } else {
          bbox = [
            Math.min(bbox[0], box[0]),
            Math.min(bbox[1], box[1]),
            Math.max(bbox[2], box[2]),
            Math.max(bbox[3], box[3]),
          ];
        }
      }
    } catch {
      // ignore invalid geometry
    }
  }
  const tileIdSet = new Set<number>();
  if (!bbox) return { tileIdSet };
  const tiles = getTilesInBounds(bbox, zBase);
  for (const tile of tiles) {
    const layer = index.getTile(tile.z, tile.x, tile.y);
    if (!layer || !Array.isArray((layer as { features?: unknown[] }).features)) continue;
    if ((layer as { features?: unknown[] }).features?.length) {
      tileIdSet.add(packTileId(tile.x, tile.y, tile.z));
    }
  }
  return { tileIdSet };
};

const buildBand3Reservations = (
  collection: FeatureCollection,
  zBase: number,
): number[] => {
  let bbox: BoundingBox | null = null;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    try {
      const box = turfBbox(feature as Feature) as BoundingBox;
      if (box.every((value) => Number.isFinite(value))) {
        if (!bbox) {
          bbox = [box[0], box[1], box[2], box[3]];
        } else {
          bbox = [
            Math.min(bbox[0], box[0]),
            Math.min(bbox[1], box[1]),
            Math.max(bbox[2], box[2]),
            Math.max(bbox[3], box[3]),
          ];
        }
      }
    } catch {
      // ignore invalid geometry
    }
  }
  if (!bbox) return [];
  const tiles = getTilesInBounds(bbox, zBase);
  return tiles.map((tile) => packTileId(tile.x, tile.y, tile.z));
};

export const createTransformHandler = (context: TransformStageContext): StageHandler<TransformTaskInput> => {
  const { shapeStore, transformConfig, bands, maxBand3Reservations } = context;
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform task input is missing' };
    }
    const band = bandMap.get(input.bandId);
    if (!band) {
      return { status: 'failed', errorMessage: `Unknown bandId: ${input.bandId}` };
    }

    const stage1Buffer = await shapeStore.stage1Buffers.get(input.stage1BufferId);
    if (!stage1Buffer) {
      return { status: 'completed', message: 'skipped: stage1 buffer not found' };
    }

    const collection = await decodeStage1Buffer(stage1Buffer.data);
    if (!collection || collection.features.length === 0) {
      return { status: 'completed', message: 'skipped: empty stage1 buffer' };
    }

    const simplified = simplifyFeatureCollection(collection, band.zMax, transformConfig.toleranceK);

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
    const encoded = await encodeFlatGeobufFromFeatureCollection(outputCollection);

    await shapeStore.transformBandBuffers.put({
      id: `${task.nodeId}-b${input.bandId}-shape-${input.sourceKey}`,
      nodeId: task.nodeId,
      bandId: input.bandId,
      domainType: 'shape',
      sourceKey: input.sourceKey,
      countryCode: input.countryCode,
      adminLevel: input.adminLevel,
      data: encoded,
      featureCount: features.length,
      vertexCount,
      timestamp: Date.now(),
    });

    const { tileIdSet } = await buildTileIndex(outputCollection, band, transformConfig.tileIndex);
    for (const tileId of tileIdSet) {
      await shapeStore.tileIndexBand.put({
        nodeId: task.nodeId,
        bandId: input.bandId,
        zBase: band.zBase,
        tileId,
        bufferId: `${task.nodeId}-b${input.bandId}-shape-${input.sourceKey}`,
      });
    }

    if (typeof adminLevel === 'number' && adminLevel >= 2) {
      const tiles = buildBand3Reservations(outputCollection, 9);
      const existingCount = await shapeStore.vtBand3Reservations.where('nodeId').equals(task.nodeId).count();
      const unique = new Set(tiles);
      if (existingCount + unique.size > maxBand3Reservations) {
        throw new Error(`band3 reservation limit exceeded: ${existingCount + unique.size} > ${maxBand3Reservations}`);
      }
      for (const tileId of unique) {
        await shapeStore.vtBand3Reservations.put({
          nodeId: task.nodeId,
          tileId,
          createdAt: Date.now(),
        });
      }
    }

    return { status: 'completed', progress: 100 };
  };
};
