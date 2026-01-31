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
    () => (selectionHash ? `${selectionHash}::${sourceKey}` : ''),
    [selectionHash, sourceKey],
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (draft.dataSource !== 'ide-gsm') return;
    if (!nodeId) return;
    if (ideGsmSources.length === 0) return;
    if (!combinedHash) return;
    if (draft.ideGsmSelectionHash === combinedHash) return;
    if (iso.status !== 'ready') return;
    if (inFlightRef.current) return;

    const selectionEntries = buildIdeGsmSelectionEntries(selection, iso.countries, BASE_LOCATION_TYPES);
    if (selectionEntries.length === 0) return;

    inFlightRef.current = true;
    onUpdate?.({ processingStatus: 'processing' });

    let cancelled = false;
    const run = async () => {
      try {
        const bridge = getWorkerBridge();
        await bridge.initialize();
        const api = await bridge.getLocationMutationAPI();
        for (const source of ideGsmSources) {
          await api.importIdeGsmLocations(
            {
              nodeId,
              sourceUrl: source.sourceUrl,
              selectionEntries,
              chunkSize: IDE_GSM_BULK_CHUNK_SIZE,
            },
            proxy((progress: IdeGsmImportProgress) => {
              updateIdeGsmProgress(nodeId, progress);
            }),
          );
        }
        if (cancelled) return;
        onUpdate?.({
          ideGsmSelectionHash: combinedHash,
          processingStatus: 'completed',
          processedAt: Date.now(),
          lastProcessedAt: Date.now(),
        });
      } catch (error) {
        if (cancelled) return;
        onUpdate?.({ processingStatus: 'failed' });
        const message = error instanceof Error ? error.message : String(error);
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
