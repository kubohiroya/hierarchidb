import type { FeatureCollection } from 'geojson';
import type { VTStageContext } from '~/contextTypes';
import type { BandConfig } from '~/types/types';
import type { GeojsonVtIndex } from './buildTileLayerIndexFromFeatures.js';
import { resolveMaxVerticesPerTile, resolveTileBufferPx } from './vtStageGeometryTileUtils.js';

export const buildLayerIndexes = async (
  context: VTStageContext,
  layers: Map<string, FeatureCollection['features']>,
  band: BandConfig,
  debugContext?: {
    taskId: string;
    nodeId: string;
    bandIndex?: number | null;
    tileId?: number | null;
    continent?: string;
  }
): Promise<Map<string, GeojsonVtIndex>> => {
  const geojsonvt = await import('geojson-vt');
  const candidate = geojsonvt as {
    default?: typeof import('geojson-vt');
  } & typeof import('geojson-vt');
  const instance = candidate.default ?? candidate;
  const indexes = new Map<string, GeojsonVtIndex>();
  const startAt = Date.now();
  if (debugContext) {
    console.info(
      '[tileEmit] index build start',
      JSON.stringify({
        ...debugContext,
        layerCount: layers.size,
        featureCount: Array.from(layers.values()).reduce(
          (sum, features) => sum + features.length,
          0
        ),
        zRange: [band.zMin, band.zMax],
      })
    );
  }

  for (const [layerName, features] of layers.entries()) {
    if (features.length === 0) continue;
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const tileBuffer = resolveTileBufferPx(context.tileEmitConfig);
    const index = instance(collection, {
      maxZoom: band.zMax,
      indexMaxZoom: band.zMax,
      extent: context.tileEmitConfig.extent,
      buffer: tileBuffer,
      tolerance: context.tileEmitConfig.tolerance,
      promoteId: context.tileEmitConfig.promoteId,
      indexMaxPoints: resolveMaxVerticesPerTile(context.tileEmitConfig.indexMaxPoints),
    });
    indexes.set(layerName, index as GeojsonVtIndex);
  }

  if (debugContext) {
    console.info(
      '[tileEmit] index build done',
      JSON.stringify({
        ...debugContext,
        indexCount: indexes.size,
        duration: Date.now() - startAt,
      })
    );
  }
  return indexes;
};
