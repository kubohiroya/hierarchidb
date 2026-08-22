import type { EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contextTypes';
import { loadGeometryCacheRecords } from './loadGeometryCacheRecords.js';
import { collectDebugTimeoutError } from './vtStageFeatureCollectorDebugSettings.js';
import {
  logCollectTransactionRejected,
  logCollectTransactionResolved,
} from './vtStageFeatureCollectorDebugUtils.js';
import { getCollectTimeoutMs, withCollectTimeout } from './vtStageTaskCollectorTimeoutUtils.js';

type FeatureCollectLoadInput = {
  context: VTStageContext;
  nodeId: string;
  bufferIds: string[];
  debugCollect: boolean;
  testTimeoutMs?: number;
  useBulkGet: boolean;
  useGetEach: boolean;
};

export const loadGeometryCacheRecordsForCollection = async (
  input: FeatureCollectLoadInput
): Promise<EphemeralGeometryCacheRecord[]> => {
  const { context, nodeId, bufferIds, debugCollect, testTimeoutMs, useBulkGet, useGetEach } = input;

  const txPromise = loadGeometryCacheRecords({
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
