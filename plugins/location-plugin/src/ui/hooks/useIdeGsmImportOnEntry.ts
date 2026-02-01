import { useEffect, useMemo, useRef } from 'react';
import { proxy } from 'comlink';
import type { NodeId } from '@hierarchidb/core-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useIsoCountries } from '@hierarchidb/ui-country-select';
import { IDE_GSM_BULK_CHUNK_SIZE, type IdeGsmImportProgress } from '@hierarchidb/location-api';
import type { LocationEntity } from '../../common/types/index.js';
import type { IdeGsmSourceEntry } from '@hierarchidb/location-api';
import { BASE_LOCATION_TYPES } from '../components/steps/locationTypes.js';
import { updateIdeGsmProgress } from '../state/ideGsmProgress.js';
import { buildIdeGsmSelectionEntries, buildIdeGsmSelectionHash } from '../utils/ideGsmSelection.js';

const debugPrefix = '[LocationIdeGsmImport]';

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
    if (draft.ideGsmSourceUrl) {
      return [{
        fileName: draft.ideGsmFileName ?? '',
        sourceUrl: draft.ideGsmSourceUrl,
      }];
    }
    return [];
  }, [draft.ideGsmFileName, draft.ideGsmSourceUrl, draft.ideGsmSources]);
  const sourceKey = useMemo(
    () => ideGsmSources.map((source) => source.sourceUrl).sort().join('|'),
    [ideGsmSources],
  );
  const combinedHash = useMemo(
    () => (selectionHash ? `${selectionHash}::${sourceKey}` : `__all__::${sourceKey}`),
    [selectionHash, sourceKey],
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (draft.dataSource !== 'ide-gsm') return;
    if (!nodeId) return;
    if (ideGsmSources.length === 0) return;
    if (draft.ideGsmSelectionHash === combinedHash) return;
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
      sources: ideGsmSources.map((source) => source.sourceUrl),
    });
    inFlightRef.current = true;
    onUpdate?.({ processingStatus: 'processing' });

    let cancelled = false;
    const run = async () => {
      try {
        const bridge = getWorkerBridge();
        await bridge.initialize();
        const api = await bridge.getLocationMutationAPI();
        for (const source of ideGsmSources) {
          const result = await api.importIdeGsmLocations(
            {
              nodeId,
              sourceUrl: source.sourceUrl,
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
          console.info(debugPrefix, 'import-result', { nodeId, sourceUrl: source.sourceUrl, total: result.total });
        }
        if (cancelled) return;
        console.info(debugPrefix, 'source-complete', {
          nodeId,
          sources: ideGsmSources.map((source) => source.sourceUrl),
        });
        console.info(debugPrefix, 'complete', { nodeId, combinedHash });
        onUpdate?.({
          ideGsmSelectionHash: combinedHash,
          processingStatus: 'completed',
          processedAt: Date.now(),
          lastProcessedAt: Date.now(),
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error(debugPrefix, 'failed', { nodeId, message, sourceKey, selectionHash });
        onUpdate?.({ processingStatus: 'failed' });
        updateIdeGsmProgress(nodeId, {
          phase: 'failed',
          message,
          timestamp: Date.now(),
        });
      } finally {
        if (!cancelled) {
          updateIdeGsmProgress(nodeId, null);
        }
        inFlightRef.current = false;
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    draft.dataSource,
    draft.ideGsmSelectionHash,
    iso.countries,
    iso.status,
    ideGsmSources,
    nodeId,
    onUpdate,
    selection,
    combinedHash,
  ]);
};
