import type { RouteEntity } from '@hierarchidb/route-api';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const strictCoverage = {
  coverageByCountryOr: {
    JP: [ROUTE_MODES.AIRWAY],
  },
  coverageByCountryAnd: {
    JP: [ROUTE_MODES.AIRWAY],
  },
  rowCount: 1,
  errorCount: 0,
  errors: [],
};

const mocks = vi.hoisted(() => ({
  resolveIdeGsmRouteCoverage: vi.fn(),
  getRouteMutationAPI: vi.fn(),
  initializeCalls: vi.fn(),
}));

const workerApiMock = vi.hoisted(() => ({
  getRouteMutationAPI: mocks.getRouteMutationAPI,
}));

const workerValueMock = vi.hoisted(() => ({
  api: workerApiMock,
  initialize: mocks.initializeCalls,
}));

const isoCountriesMock = vi.hoisted(() => [
  { code: 'JP', name: 'Japan', nativeName: 'Japan', continent: 'AS' },
  { code: 'US', name: 'United States', nativeName: 'United States', continent: 'NA' },
]);

const translateMock = vi.hoisted(() => vi.fn((_key: string, fallback?: string) => fallback ?? ''));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  useWorkerAPI: () => workerValueMock,
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => ({
    status: 'ready',
    countries: isoCountriesMock,
  }),
}));

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: translateMock,
    translations: {},
  }),
}));

import { useRouteSelectionStep } from '../useRouteSelectionStep';

describe('useRouteSelectionStep IDE-GSM coverage resolution', () => {
  beforeEach(() => {
    mocks.resolveIdeGsmRouteCoverage.mockReset();
    mocks.getRouteMutationAPI.mockReset();
    mocks.initializeCalls.mockReset();
    mocks.resolveIdeGsmRouteCoverage.mockResolvedValue(strictCoverage);
    mocks.getRouteMutationAPI.mockResolvedValue({
      resolveIdeGsmRouteCoverage: mocks.resolveIdeGsmRouteCoverage,
    });
    mocks.initializeCalls.mockResolvedValue(undefined);
  });

  it('does not re-run coverage fetch for identical node/source on rerender', async () => {
    const onUpdate = vi.fn();
    const onValidationChange = vi.fn();
    const draft: Partial<RouteEntity> = {
      dataSourceName: 'ide-gsm',
      tabularSourceId: 'tabular-1',
      selectedArrayByCountries: {
        JP: [true, false, false, false, false, true, false, false, false, false],
      },
    };

    const { rerender } = renderHook(
      (props: {
        draft: Partial<RouteEntity>;
        onUpdate: (updates: Partial<RouteEntity>) => void;
        onValidationChange: (isValid: boolean) => void;
        mode: 'create' | 'edit';
        nodeId?: string;
      }) => useRouteSelectionStep(props),
      {
        initialProps: {
          draft,
          onUpdate,
          onValidationChange,
          mode: 'create',
          nodeId: 'route-node-1',
        },
      }
    );

    await waitFor(() => {
      expect(mocks.resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });
    rerender({
      draft,
      onUpdate,
      onValidationChange,
      mode: 'create',
      nodeId: 'route-node-1',
    });

    await waitFor(() => {
      expect(mocks.resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });
  });

  it('uses only coverage countries for matrix rows and selectedArrayByCountries', async () => {
    const onUpdate = vi.fn();
    const onValidationChange = vi.fn();

    const { result } = renderHook(() =>
      useRouteSelectionStep({
        draft: {
          dataSourceName: 'ide-gsm',
          tabularSourceId: 'tabular-1',
          selectedArrayByCountries: {},
        },
        onUpdate,
        onValidationChange,
        mode: 'create',
        nodeId: 'route-node-1',
      })
    );

    await waitFor(() => {
      expect(mocks.resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.selectableCountries.map((country) => country.code)).toEqual(['JP']);
    });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        selectedArrayByCountries: {
          JP: [true, false, false, false, false, true, false, false, false, false],
        },
      });
    });
  });

  it('rejects the legacy coverageByCountry alias', async () => {
    mocks.resolveIdeGsmRouteCoverage.mockResolvedValueOnce({
      coverageByCountry: {
        JP: [ROUTE_MODES.AIRWAY],
      },
      rowCount: 1,
      errorCount: 0,
      errors: [],
    });

    const { result } = renderHook(() =>
      useRouteSelectionStep({
        draft: {
          dataSourceName: 'ide-gsm',
          tabularSourceId: 'tabular-1',
          selectedArrayByCountries: {},
        },
        onUpdate: vi.fn(),
        onValidationChange: vi.fn(),
        mode: 'create',
        nodeId: 'route-node-1',
      })
    );

    await waitFor(() => {
      expect(mocks.resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.selectionErrorMessage).toContain(
        'coverageByCountry alias is not supported'
      );
    });
  });
});
