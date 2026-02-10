import { act, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { toNodeId } from '@hierarchidb/core-types';
import type { LocationEntity } from '../../../../common/types/index.js';
import { useIdeGsmImportOnEntry } from '../../useIdeGsmImportOnEntry.js';

type ImportProgressCallback = (progress: {
  phase: string;
  processed?: number;
  total?: number;
  chunk?: number;
}) => void;

const mocks = vi.hoisted(() => {
  const importIdeGsmLocations = vi.fn();
  const getLocationMutationAPI = vi.fn(async () => ({
    importIdeGsmLocations,
  }));
  const initialize = vi.fn(async () => undefined);
  const countries = [{ code: 'JP', name: 'Japan', continent: 'AS' as const }];
  return {
    importIdeGsmLocations,
    getLocationMutationAPI,
    initialize,
    countries,
  };
});

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => ({
    status: 'ready' as const,
    countries: mocks.countries,
  }),
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  useWorkerAPI: () => ({
    api: {
      getLocationMutationAPI: mocks.getLocationMutationAPI,
    },
    loading: false,
    error: null,
    initialize: mocks.initialize,
  }),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const INITIAL_DRAFT: Partial<LocationEntity> = {
  dataSource: 'ide-gsm',
  tabularSourceId: 'source-1',
  selectedArrayByCountries: {
    JP: [true, false, false, false, false],
  },
};

describe('useIdeGsmImportOnEntry', () => {
  beforeEach(() => {
    mocks.importIdeGsmLocations.mockReset();
    mocks.getLocationMutationAPI.mockClear();
    mocks.initialize.mockClear();
  });

  it('completes import once even when onUpdate callback reference changes during processing', async () => {
    const deferred = createDeferred<void>();
    mocks.importIdeGsmLocations.mockImplementation(
      async (_request: unknown, onProgress: ImportProgressCallback) => {
        onProgress({ phase: 'fetch' });
        await deferred.promise;
        onProgress({ phase: 'completed', processed: 1, total: 1, chunk: 1 });
        return { total: 1 };
      },
    );

    const nodeId = toNodeId('location-import-node-1');
    const { result } = renderHook(() => {
      const [draft, setDraft] = useState<Partial<LocationEntity>>(INITIAL_DRAFT);
      const [callbackVersion, setCallbackVersion] = useState(0);
      const [updatesLog, setUpdatesLog] = useState<Array<Partial<LocationEntity>>>([]);

      const onUpdate = useCallback((updates: Partial<LocationEntity>) => {
        setUpdatesLog((prev) => [...prev, updates]);
        setDraft((prev) => ({ ...prev, ...updates }));
        setCallbackVersion((prev) => prev + 1);
      }, [callbackVersion]);

      useIdeGsmImportOnEntry({ draft, nodeId, onUpdate });
      return { draft, updatesLog };
    });

    await waitFor(() => {
      expect(mocks.importIdeGsmLocations).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      deferred.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.draft.processingStatus).toBe('completed');
      expect(typeof result.current.draft.ideGsmSelectionHash).toBe('string');
    });

    expect(mocks.importIdeGsmLocations).toHaveBeenCalledTimes(1);
    expect(result.current.updatesLog.some((entry) => entry.processingStatus === 'processing')).toBe(true);
    expect(result.current.updatesLog.some((entry) => entry.processingStatus === 'completed')).toBe(true);
  });
});

