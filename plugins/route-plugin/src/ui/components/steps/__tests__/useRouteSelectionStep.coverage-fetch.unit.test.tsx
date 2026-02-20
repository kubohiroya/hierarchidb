import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { RouteEntity } from '@hierarchidb/route-api';
import { ROUTE_MODES } from '@hierarchidb/route-api';

const resolveIdeGsmRouteCoverage = vi.fn(async () => ({
  coverageByCountry: {
    JP: [ROUTE_MODES.AIRWAY],
  },
  errors: [],
}));

const getRouteMutationAPI = vi.fn(async () => ({
  resolveIdeGsmRouteCoverage,
}));

const initializeCalls = vi.fn(async () => undefined);

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  useWorkerAPI: () => ({
    api: {
      getRouteMutationAPI,
    },
    initialize: async () => initializeCalls(),
  }),
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => ({
    status: 'ready',
    countries: [{ code: 'JP', name: 'Japan', nativeName: 'Japan', continent: 'AS' }],
  }),
}));

vi.mock('../../../common/i18n/index.js', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
    translations: {},
  }),
}));

import { useRouteSelectionStep } from '~/ui/components/steps/useRouteSelectionStep';

describe('useRouteSelectionStep IDE-GSM coverage resolution', () => {
  it('does not re-run coverage fetch for identical node/source on rerender', async () => {
    const onUpdate = vi.fn();
    const onValidationChange = vi.fn();
    const draft: Partial<RouteEntity> = {
      dataSourceName: 'ide-gsm',
      tabularSourceId: 'tabular-1',
      selectedArrayByCountries: {
        JP: [true, false, false, false, false],
      },
    };

    const { rerender } = renderHook((props: {
      draft: Partial<RouteEntity>;
      onUpdate: (updates: Partial<RouteEntity>) => void;
      onValidationChange: (isValid: boolean) => void;
      mode: 'create' | 'edit';
      nodeId?: string;
    }) => useRouteSelectionStep(props), {
      initialProps: {
        draft,
        onUpdate,
        onValidationChange,
        mode: 'create',
        nodeId: 'route-node-1',
      },
    });

    await waitFor(() => {
      expect(resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });

    rerender({
      draft,
      onUpdate,
      onValidationChange,
      mode: 'create',
      nodeId: 'route-node-1',
    });

    await waitFor(() => {
      expect(resolveIdeGsmRouteCoverage).toHaveBeenCalledTimes(1);
    });
  });
});
