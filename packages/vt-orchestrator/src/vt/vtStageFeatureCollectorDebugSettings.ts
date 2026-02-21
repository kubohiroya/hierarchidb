export type VtCollectDebugSettings = {
  debugCollect: boolean;
  testTimeoutMs: number | undefined;
  useBulkGet: boolean;
  useGetEach: boolean;
};

const getGlobalBoolean = (name: string): boolean => (
  (globalThis as Record<string, unknown>)[name] === true
);

const getGlobalNumber = (name: string): number | undefined => {
  const value = (globalThis as Record<string, unknown>)[name];
  return typeof value === 'number' ? value : undefined;
};

export const getCollectDebugSettings = (): VtCollectDebugSettings => ({
  debugCollect: getGlobalBoolean('__HDB_VT_DEBUG_COLLECT'),
  testTimeoutMs: getGlobalNumber('__HDB_VT_COLLECT_TIMEOUT_MS'),
  useBulkGet: getGlobalBoolean('__HDB_VT_COLLECT_BULKGET'),
  useGetEach: getGlobalBoolean('__HDB_VT_COLLECT_GET_EACH'),
});

export const collectDebugTimeoutError = (nodeId: string, timeoutMs?: number): Error => {
  const finalTimeoutMs = timeoutMs ?? getGlobalNumber('__HDB_VT_COLLECT_TIMEOUT_MS') ?? 15000;
  return new Error(`[vt][debug] collect transaction timeout after ${finalTimeoutMs}ms (nodeId=${String(nodeId)})`);
};
