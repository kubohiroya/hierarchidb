import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CountryMetadata } from '~/common/types/index';
import { useShapeCountrySelectionStepSelectionState } from '../../../components/country-selection/internal/useShapeCountrySelectionStepSelectionState.js';

const enqueueSnackbar = vi.fn();

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

const countries: CountryMetadata[] = [
  {
    countryCode: 'JP',
    iso2: 'JP',
    countryName: 'Japan',
    availableAdminLevels: [0, 1],
  },
];

const nodeId = 'selection-baseline-unit' as NodeId;

describe('useShapeCountrySelectionStepSelectionState invalidation baseline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    enqueueSnackbar.mockReset();
  });

  it('keeps the prior baseline when invalidation rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onInvalidate = vi.fn().mockRejectedValue(new Error('cleanup failed'));
    const onChange = vi.fn();
    const view = renderHook(
      ({ selection }: { selection: Record<string, boolean[]> }) =>
        useShapeCountrySelectionStepSelectionState({
          nodeId,
          countries,
          availability: null,
          selectedArrayByCountries: selection,
          resolvedMaxAdminLevel: 1,
          iso: undefined,
          onChange,
          onInvalidate,
        }),
      { initialProps: { selection: { JP: [true, true] } } }
    );

    view.rerender({ selection: { JP: [false, true] } });
    await waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());

    view.rerender({ selection: { JP: [false, false] } });
    await waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(2));

    expect(onInvalidate.mock.calls[1]?.[0]).toEqual({ JP: [true, true] });
  });

  it('advances the baseline only after invalidation succeeds', async () => {
    const onInvalidate = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    const view = renderHook(
      ({ selection }: { selection: Record<string, boolean[]> }) =>
        useShapeCountrySelectionStepSelectionState({
          nodeId,
          countries,
          availability: null,
          selectedArrayByCountries: selection,
          resolvedMaxAdminLevel: 1,
          iso: undefined,
          onChange,
          onInvalidate,
        }),
      { initialProps: { selection: { JP: [true, true] } } }
    );

    view.rerender({ selection: { JP: [false, true] } });
    await waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());

    view.rerender({ selection: { JP: [false, false] } });
    await waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(2));

    expect(onInvalidate.mock.calls[1]?.[0]).toEqual({ JP: [false, true] });
  });
});
