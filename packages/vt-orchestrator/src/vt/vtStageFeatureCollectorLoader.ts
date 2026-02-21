import type { EphemeralTransformCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contexts';

type FeatureCollectorLoadConfig = {
  context: VTStageContext;
  nodeId: string;
  bufferIds: string[];
  useBulkGet: boolean;
  useGetEach: boolean;
  debugCollect: boolean;
};

export const loadTransformCacheRecords = async (
  config: FeatureCollectorLoadConfig,
): Promise<EphemeralTransformCacheRecord[]> => {
  const {
    context,
    nodeId,
    bufferIds,
    useBulkGet,
    useGetEach,
    debugCollect,
  } = config;
  return context.ephemeralDB.transaction('r', [context.ephemeralDB.transformCache], async () => {
    if (debugCollect) {
      console.info('[vt][debug] collect transaction start', JSON.stringify({ nodeId }));
    }
    let loaded: EphemeralTransformCacheRecord[];
    if (useGetEach) {
      const collected: EphemeralTransformCacheRecord[] = [];
      for (const bufferId of bufferIds) {
        if (debugCollect) {
          console.info('[vt][debug] collect get start', JSON.stringify({ nodeId, bufferId }));
        }
        const record = await context.ephemeralDB.transformCache.get(bufferId);
        if (debugCollect) {
          console.info('[vt][debug] collect get done', JSON.stringify({
            nodeId,
            bufferId,
            hasRecord: Boolean(record),
          }));
        }
        if (record) {
          collected.push(record);
        }
      }
      loaded = collected;
    } else if (useBulkGet) {
      loaded = (await context.ephemeralDB.transformCache.bulkGet(bufferIds))
        .filter((record): record is EphemeralTransformCacheRecord => Boolean(record));
    } else {
      loaded = await context.ephemeralDB.transformCache
        .where('id')
        .anyOf(bufferIds)
        .toArray();
    }
    if (debugCollect) {
      console.info('[vt][debug] collect transaction done', JSON.stringify({ nodeId }));
    }
    return loaded;
  });
};
