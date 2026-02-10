import { useEffect, useMemo, useRef } from 'react';
import { proxy } from 'comlink';
import type { NodeId } from '@hierarchidb/core-types';
import { useIsoCountries } from '@hierarchidb/ui-country-select';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { IDE_GSM_BULK_CHUNK_SIZE, type IdeGsmImportProgress } from '@hierarchidb/location-api';
import { resolveDbPrefix } from '@hierarchidb/util';
import type { LocationEntity } from '../../common/types/index.js';
import type { IdeGsmSourceEntry } from '@hierarchidb/location-api';
import { BASE_LOCATION_TYPES } from '../components/steps/locationTypes.js';
import { updateIdeGsmProgress } from '../state/ideGsmProgress.js';
import { buildIdeGsmSelectionEntries, buildIdeGsmSelectionHash } from '../utils/ideGsmSelection.js';

const debugPrefix = '[LocationIdeGsmImport]';
const inFlightByNode = new Map<string, boolean>();
const lastCompletedByNode = new Map<string, string>();
type FailedImportRecord = {
  combinedHash: string;
};
const lastFailedByNode = new Map<string, FailedImportRecord>();

export const useIdeGsmImportOnEntry = ({
  draft,
  nodeId,
  onUpdate,
}: {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}): void => {
  const iso = useIsoCountries();
  const selection = draft.selectedArrayByCountries ?? {};
  const selectionHash = useMemo(() => buildIdeGsmSelectionHash(selection), [selection]);
  const fallbackCountries = useMemo(() => (
    Object.keys(selection).map((code) => ({ code, name: code, continent: 'XX' as const }))
  ), [selection]);
  const ideGsmSources = useMemo<IdeGsmSourceEntry[]>(() => {
    if (draft.ideGsmSources && draft.ideGsmSources.length > 0) {
      return draft.ideGsmSources;
    }
    if (draft.tabularSourceId) {
      return [{
        fileName: draft.ideGsmFileName ?? '',
        tabularSourceId: draft.tabularSourceId,
      }];
    }
    return [];
  }, [draft.ideGsmFileName, draft.ideGsmSources, draft.tabularSourceId]);
  const validSources = useMemo(
    () => ideGsmSources.filter((source) => typeof source.tabularSourceId === 'string' && source.tabularSourceId.length > 0),
    [ideGsmSources],
  );
  const sourceKey = useMemo(
    () => validSources.map((source) => source.tabularSourceId).sort().join('|'),
    [validSources],
  );
  const sourceIds = useMemo(
    () => sourceKey.split('|').filter((value) => value.length > 0),
    [sourceKey],
  );
  const tabularDbPrefix = useMemo(() => resolveDbPrefix(), []);
  const combinedHash = useMemo(
    () => (selectionHash ? `${selectionHash}::${sourceKey}` : `__all__::${sourceKey}`),
    [selectionHash, sourceKey],
  );
  const inFlightRef = useRef(false);
  const onUpdateRef = useRef<typeof onUpdate>(onUpdate);
  const mountedRef = useRef(true);
  const activeRunRef = useRef<{ nodeKey: string; combinedHash: string } | null>(null);
  const {
    api: workerApi,
    loading: workerLoading,
    error: workerError,
  } = useWorkerAPI();
  const workerApiRef = useRef(workerApi);
  const workerReady = !workerLoading && !workerError && Boolean(workerApi);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    workerApiRef.current = workerApi;
  }, [workerApi]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (draft.dataSource !== 'ide-gsm') return;
    if (!nodeId) return;
    const nodeKey = String(nodeId);
    if (sourceIds.length === 0) return;
    if (!workerReady) return;
    if (draft.processingStatus === 'processing') return;
    if (draft.ideGsmSelectionHash === combinedHash) return;
    const failedRecord = lastFailedByNode.get(nodeKey);
    if (
      failedRecord
      && failedRecord.combinedHash === combinedHash
    ) {
      return;
    }
    if (lastCompletedByNode.get(nodeKey) === combinedHash) return;
    if (inFlightByNode.get(nodeKey)) return;
    if (inFlightRef.current) return;

    const selectionEntries = buildIdeGsmSelectionEntries(
      selection,
      iso.status === 'ready' ? iso.countries : fallbackCountries,
      BASE_LOCATION_TYPES,
    );
    if (selectionEntries.length === 0 && selectionHash) return;

    console.info(debugPrefix, 'start', {
      nodeId,
      sourceKey,
      selectionHash,
      combinedHash,
      selectionEntriesCount: selectionEntries.length,
      sources: sourceIds,
      retryingAfterFailure: Boolean(failedRecord && failedRecord.combinedHash === combinedHash),
    });
    inFlightRef.current = true;
    inFlightByNode.set(nodeKey, true);
    lastFailedByNode.delete(nodeKey);
    activeRunRef.current = { nodeKey, combinedHash };

    let cancelled = false;
    const canApplyResult = () => {
      if (!mountedRef.current) return false;
      if (!cancelled) return true;
      const active = activeRunRef.current;
      return Boolean(active && active.nodeKey === nodeKey && active.combinedHash === combinedHash);
    };
    const run = async () => {
      try {
        if (!canApplyResult()) return;
        onUpdateRef.current?.({ processingStatus: 'processing' });
        const activeWorkerApi = workerApiRef.current;
        if (!activeWorkerApi) {
          throw new Error('Worker API is unavailable');
        }
        const api = await activeWorkerApi.getLocationMutationAPI();
        for (const sourceId of sourceIds) {
          const result = await api.importIdeGsmLocations(
            {
              nodeId,
              tabularSourceId: sourceId,
              tabularDbPrefix,
              selectionEntries,
              chunkSize: IDE_GSM_BULK_CHUNK_SIZE,
              mode: 'upsert',
            },
            proxy((progress: IdeGsmImportProgress) => {
              console.info(debugPrefix, 'progress', {
                nodeId,
                phase: progress.phase,
                processed: progress.processed,
                total: progress.total,
                chunk: progress.chunk,
              });
              updateIdeGsmProgress(nodeId, progress);
            }),
          );
          console.info(debugPrefix, 'import-result', { nodeId, tabularSourceId: sourceId, total: result.total });
        }
        if (!canApplyResult()) {
          lastCompletedByNode.set(nodeKey, combinedHash);
          return;
        }
        console.info(debugPrefix, 'source-complete', {
          nodeId,
          sources: sourceIds,
        });
        console.info(debugPrefix, 'complete', { nodeId, combinedHash });
        onUpdateRef.current?.({
          ideGsmSelectionHash: combinedHash,
          processingStatus: 'completed',
          processedAt: Date.now(),
          lastProcessedAt: Date.now(),
        });
        lastCompletedByNode.set(nodeKey, combinedHash);
        lastFailedByNode.delete(nodeKey);
      } catch (error) {
        if (!canApplyResult()) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error(debugPrefix, 'failed', { nodeId, message, sourceKey, selectionHash });
        lastFailedByNode.set(nodeKey, {
          combinedHash,
        });
        onUpdateRef.current?.({ processingStatus: 'failed' });
        updateIdeGsmProgress(nodeId, {
          phase: 'failed',
          message,
          timestamp: Date.now(),
        });
      } finally {
        if (canApplyResult()) {
          updateIdeGsmProgress(nodeId, null);
        }
        inFlightRef.current = false;
        inFlightByNode.delete(nodeKey);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    combinedHash,
    draft.dataSource,
    draft.ideGsmSelectionHash,
    draft.processingStatus,
    nodeId,
    selectionHash,
    sourceIds,
    tabularDbPrefix,
    workerReady,
  ]);
};
