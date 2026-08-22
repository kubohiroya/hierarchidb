import type { EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contextTypes';

type FeatureCollectorLoadConfig = {
  context: VTStageContext;
  nodeId: string;
  bufferIds: string[];
  useBulkGet: boolean;
  useGetEach: boolean;
  debugCollect: boolean;
};

export const loadGeometryCacheRecords = async (
  config: FeatureCollectorLoadConfig
): Promise<EphemeralGeometryCacheRecord[]> => {
  const { context, nodeId, bufferIds, useBulkGet, useGetEach, debugCollect } = config;
  return context.ephemeralDB.transaction('r', [context.ephemeralDB.geometryCache], async () => {
    if (debugCollect) {
      console.info('[tileEmit][debug] collect transaction start', JSON.stringify({ nodeId }));
    }
    let loaded: EphemeralGeometryCacheRecord[];
    if (useGetEach) {
      const collected: EphemeralGeometryCacheRecord[] = [];
      for (const bufferId of bufferIds) {
        if (debugCollect) {
          console.info('[tileEmit][debug] collect get start', JSON.stringify({ nodeId, bufferId }));
        }
        const record = await context.ephemeralDB.geometryCache.get(bufferId);
        if (debugCollect) {
          console.info(
            '[tileEmit][debug] collect get done',
            JSON.stringify({
              nodeId,
              bufferId,
              hasRecord: Boolean(record),
            })
          );
        }
        if (record) {
          collected.push(record);
        }
      }
      loaded = collected;
    } else if (useBulkGet) {
      loaded = (await context.ephemeralDB.geometryCache.bulkGet(bufferIds)).filter(
        (record): record is EphemeralGeometryCacheRecord => Boolean(record)
      );
    } else {
      loaded = await context.ephemeralDB.geometryCache.where('id').anyOf(bufferIds).toArray();
    }
    if (debugCollect) {
      console.info('[tileEmit][debug] collect transaction done', JSON.stringify({ nodeId }));
    }
    return loaded;
  });
};
