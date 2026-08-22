import type { EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';

export const logCollectBuffersStart = (input: {
  nodeId: string;
  bufferCount: number;
  testTimeoutMs?: number;
  useBulkGet: boolean;
}): void => {
  const { nodeId, bufferCount, testTimeoutMs, useBulkGet } = input;
  console.info(
    '[tileEmit][debug] collect buffers',
    JSON.stringify({
      nodeId,
      bufferCount,
      testTimeoutMs: typeof testTimeoutMs === 'number' ? testTimeoutMs : null,
    })
  );
  console.info(
    '[tileEmit][debug] collect fetch start',
    JSON.stringify({
      nodeId,
      useBulkGet,
      bufferCount,
    })
  );
};

export const logCollectCountStart = (nodeId: string): number => {
  console.info('[tileEmit][debug] collect count start', JSON.stringify({ nodeId }));
  return Date.now();
};

export const logCollectCountDone = (nodeId: string, count: number, startedAt: number): void => {
  console.info(
    '[tileEmit][debug] collect count done',
    JSON.stringify({
      nodeId,
      count,
      durationMs: Date.now() - startedAt,
    })
  );
};

const formatRecordShapeValue = (value: unknown): number | null => {
  const isObject = value !== null && typeof value === 'object';
  if (!isObject || typeof ArrayBuffer === 'undefined') {
    return null;
  }
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.byteLength;
  }
  return null;
};

export const logCollectTransactionResolved = (nodeId: string, count: number): void => {
  console.info(
    '[tileEmit][debug] collect transaction resolved',
    JSON.stringify({
      nodeId,
      recordCount: count,
    })
  );
};

export const logCollectTransactionRejected = (nodeId: string, error: unknown): void => {
  console.info(
    '[tileEmit][debug] collect transaction rejected',
    JSON.stringify({
      nodeId,
      error: error instanceof Error ? error.message : String(error),
    })
  );
};

export const logCollectSummary = (
  nodeId: string,
  allFeaturesCount: number,
  featureStatsCount: number,
  bufferSizeCount: number
): void => {
  console.info(
    '[tileEmit][debug] collect features summary',
    JSON.stringify({
      nodeId,
      allFeatures: allFeaturesCount,
      featureStats: featureStatsCount,
      bufferSizeCount,
    })
  );
};

export const logCollectRecordSnapshot = (
  nodeId: string,
  records: EphemeralGeometryCacheRecord[]
): void => {
  try {
    const first = records[0];
    const recordSample = records.slice(0, Math.min(records.length, 3)).map((record) => record.id);
    console.log(
      '[tileEmit][debug] collect transaction return',
      JSON.stringify({
        nodeId,
        recordCount: records.length,
        recordSample,
        bufferId: first?.id ?? null,
        byteLength: first?.data?.byteLength ?? null,
      })
    );
    if (!first) {
      console.info(
        '[tileEmit][debug] record shape probe',
        JSON.stringify({
          nodeId,
          hasRecord: false,
        })
      );
      return;
    }

    const data = first.data;
    const dataIsObject = data !== null && typeof data === 'object';
    const dataConstructorName = dataIsObject
      ? ((data as { constructor?: { name?: string } }).constructor?.name ?? null)
      : null;
    const dataByteLength = formatRecordShapeValue(first?.data);
    const dataSize =
      dataIsObject && 'size' in (data as { size?: number })
        ? ((data as { size?: number }).size ?? null)
        : null;
    const isUint8Array = typeof Uint8Array !== 'undefined' && data instanceof Uint8Array;
    const isArrayBufferView =
      dataIsObject && typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function'
        ? ArrayBuffer.isView(data)
        : null;
    const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer;

    console.info(
      '[tileEmit][debug] record shape probe',
      JSON.stringify({
        nodeId,
        hasRecord: true,
        recordKeys: Object.keys(first),
        dataType: data === null ? 'null' : typeof data,
        dataConstructorName,
        dataByteLength,
        dataSize,
        isArrayBuffer,
        isArrayBufferView,
        isUint8Array,
        timestamp: first.timestamp ?? null,
        countryCode: first.countryCode ?? null,
        sourceKey: first.sourceKey ?? null,
      })
    );
  } catch (error) {
    console.info(
      '[tileEmit][debug] record loop start failed',
      JSON.stringify({
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
};
