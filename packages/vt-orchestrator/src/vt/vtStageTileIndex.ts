import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contexts';
import { resolveMaxVerticesPerTile } from './vtStageGeometryTile.js';
import { simplifyTileFeatureCollectionWithTopojson } from './vtStageTileIndexSimplification.js';

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
  const maxVerticesPerTile = resolveMaxVerticesPerTile(params.context.tileEmitConfig.indexMaxPoints);
  let collection: FeatureCollection = { type: 'FeatureCollection', features: params.features };
  if (params.topojsonSimplify?.enabled) {
    const simplifyResult = await simplifyTileFeatureCollectionWithTopojson({
      collection,
      zTarget: params.z,
      toleranceK: params.topojsonSimplify.toleranceK,
      retryToleranceStep: params.topojsonSimplify.retryToleranceStep,
      maxVerticesPerTile,
      quantize: params.topojsonSimplify.quantize,
      extent: params.context.tileEmitConfig.extent,
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
          console.info('[tileEmit][debug] topojson simplify attempt', JSON.stringify(details));
        }
      },
    });
    collection = simplifyResult.collection;
  }

  const index = params.geojsonVt(collection, {
    maxZoom: params.z,
    indexMaxZoom: params.z,
    extent: params.context.tileEmitConfig.extent,
    buffer: params.context.tileEmitConfig.bufferSize,
    tolerance: params.topojsonSimplify?.enabled ? 0 : params.context.tileEmitConfig.tolerance,
    promoteId: params.context.tileEmitConfig.promoteId,
    indexMaxPoints: maxVerticesPerTile,
  }) as GeojsonVtIndex;

  const indexedTile = index.getTile(params.z, params.x, params.y);
  if (!indexedTile || !Array.isArray(indexedTile.features) || indexedTile.features.length === 0) return null;
  return indexedTile as Tile;
};
