import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contextTypes';
import { assertTileEmitGeojsonVtInputContract } from './filterInvalidGeometryForTileEmit.js';
import { resolveMaxVerticesPerTile, resolveTileBufferPx } from './vtStageGeometryTileUtils.js';

export type GeojsonVtIndex = { getTile: (z: number, x: number, y: number) => Tile | null };

export const buildTileLayerIndexFromFeatures = async (params: {
  layerName: string;
  features: Feature<Geometry>[];
  z: number;
  x: number;
  y: number;
  bandMaxZoom: number;
  context: VTStageContext;
  geojsonVt: (
    collection: FeatureCollection,
    options: {
      maxZoom: number;
      indexMaxZoom: number;
      extent: number;
      buffer: number;
      tolerance: number;
      promoteId: string;
      indexMaxPoints: number;
    }
  ) => GeojsonVtIndex;
  topojsonSimplify?: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  };
  debugCollect?: boolean;
}): Promise<Tile | null> => {
  if (params.features.length === 0) return null;
  if (params.topojsonSimplify?.enabled) {
    throw new Error(
      '[tileEmit] tile-local TopoJSON simplification is not supported after the canonical invalid-geometry filter boundary'
    );
  }
  const maxVerticesPerTile = resolveMaxVerticesPerTile(
    params.context.tileEmitConfig.indexMaxPoints
  );
  const tileBuffer = resolveTileBufferPx(params.context.tileEmitConfig);
  const collection: FeatureCollection = { type: 'FeatureCollection', features: params.features };
  await assertTileEmitGeojsonVtInputContract(collection, params.context.geometryEngine);

  const index = params.geojsonVt(collection, {
    maxZoom: params.bandMaxZoom,
    indexMaxZoom: params.bandMaxZoom,
    extent: params.context.tileEmitConfig.extent,
    buffer: tileBuffer,
    tolerance: params.context.tileEmitConfig.tolerance,
    promoteId: params.context.tileEmitConfig.promoteId,
    indexMaxPoints: maxVerticesPerTile,
  }) as GeojsonVtIndex;

  const indexedTile = index.getTile(params.z, params.x, params.y);
  if (!indexedTile || !Array.isArray(indexedTile.features) || indexedTile.features.length === 0)
    return null;
  return indexedTile as Tile;
};
