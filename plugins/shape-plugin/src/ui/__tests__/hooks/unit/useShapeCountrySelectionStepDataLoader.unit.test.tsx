import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countrySelectionBootstrapCache } from '../../../components/country-selection/internal/selectionUtils.js';
import { useShapeCountrySelectionStepDataLoader } from '../../../components/country-selection/internal/useShapeCountrySelectionStepDataLoader.js';

const mocks = vi.hoisted(() => ({
  enqueueSnackbar: vi.fn(),
  getOrCreateAvailabilityWorkerHandle: vi.fn(),
  isoState: { status: 'ready', countries: [] },
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => mocks.isoState,
}));

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }),
}));

vi.mock(
  '../../../components/country-selection/internal/getOrCreateAvailabilityWorkerHandle.js',
  () => ({
    getOrCreateAvailabilityWorkerHandle: mocks.getOrCreateAvailabilityWorkerHandle,
  })
);

afterEach(() => {
  countrySelectionBootstrapCache.clear();
  vi.clearAllMocks();
});

describe('useShapeCountrySelectionStepDataLoader worker initialization', () => {
  it('creates one worker per explicit attempt after a synchronous construction failure', async () => {
    mocks.getOrCreateAvailabilityWorkerHandle.mockImplementation(() => {
      throw new Error('Country availability worker construction failed.');
    });
    const view = renderHook(() =>
      useShapeCountrySelectionStepDataLoader({
        dataSourceKey: 'geoboundaries',
        nodeId: 'shape-country-loader-test' as NodeId,
      })
    );

    await waitFor(() =>
      expect(view.result.current.availabilityError?.message).toBe(
        'Country availability worker construction failed.'
      )
    );
    expect(mocks.getOrCreateAvailabilityWorkerHandle).toHaveBeenCalledOnce();
    expect(view.result.current.metadataLoading).toBe(false);
    expect(view.result.current.availabilityLoading).toBe(false);

    await act(async () => {
      await view.result.current.reloadAll();
    });

    expect(mocks.getOrCreateAvailabilityWorkerHandle).toHaveBeenCalledTimes(2);
  });

  it('shares one rejected bridge attempt until the user explicitly retries', async () => {
    mocks.getOrCreateAvailabilityWorkerHandle.mockImplementation(() => ({
      worker: {},
      api: {},
      bridgeReady: Promise.reject(
        new Error('Country availability worker UI storage bridge initialization failed.')
      ),
    }));
    const view = renderHook(() =>
      useShapeCountrySelectionStepDataLoader({
        dataSourceKey: 'geoboundaries',
        nodeId: 'shape-country-loader-bridge-test' as NodeId,
      })
    );

    await waitFor(() =>
      expect(view.result.current.availabilityError?.message).toBe(
        'Country availability worker UI storage bridge initialization failed.'
      )
    );
    expect(mocks.getOrCreateAvailabilityWorkerHandle).toHaveBeenCalledOnce();
    expect(view.result.current.metadataLoading).toBe(false);
    expect(view.result.current.availabilityLoading).toBe(false);

    await act(async () => {
      await view.result.current.reloadAll();
    });

    expect(mocks.getOrCreateAvailabilityWorkerHandle).toHaveBeenCalledTimes(2);
  });
});
