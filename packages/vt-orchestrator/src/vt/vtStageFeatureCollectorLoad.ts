import type { EphemeralTransformCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contexts';
import { collectDebugTimeoutError } from './vtStageFeatureCollectorDebugSettings.js';
import { loadTransformCacheRecords } from './vtStageFeatureCollectorLoader.js';
import { getCollectTimeoutMs, withCollectTimeout } from './vtStageTaskCollectorTimeout.js';
import {
  logCollectTransactionRejected,
  logCollectTransactionResolved,
} from './vtStageFeatureCollectorDebug.js';

type FeatureCollectLoadInput = {
  context: VTStageContext;
  nodeId: string;
  bufferIds: string[];
  debugCollect: boolean;
  testTimeoutMs?: number;
  useBulkGet: boolean;
  useGetEach: boolean;
};

export const loadTransformCacheRecordsForCollection = async (
  input: FeatureCollectLoadInput,
): Promise<EphemeralTransformCacheRecord[]> => {
  const {
    context,
    nodeId,
    bufferIds,
    debugCollect,
    testTimeoutMs,
    useBulkGet,
    useGetEach,
  } = input;

  const txPromise = loadTransformCacheRecords({
    context,
    nodeId,
    bufferIds,
    useBulkGet,
    useGetEach,
    debugCollect,
  });

  if (debugCollect) {
    txPromise
      .then((loaded) => {
        logCollectTransactionResolved(nodeId, loaded.length);
      })
      .catch((error) => {
        logCollectTransactionRejected(nodeId, error);
      });
  }

  if (!debugCollect) {
    return await txPromise;
  }

  return withCollectTimeout({
    nodeId,
    promise: txPromise,
    timeoutMs: getCollectTimeoutMs({ testTimeoutMs }),
    errorFactory: ({ timeoutMs }) => collectDebugTimeoutError(nodeId, timeoutMs),
  });
};
