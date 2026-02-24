import { act, renderHook, waitFor } from '@testing-library/react';
import type { NodeId } from '@hierarchidb/core-types';
import type { CountryMetadata } from '../../../../common/types/index';

const enqueueSnackbarMock = vi.fn();
const onStepNavigateMock = vi.fn();
const onChangeMock = vi.fn();

const mockWorkerApi = {
  setUiStorageBridge: vi.fn().mockResolvedValue(undefined),
  loadAvailability: vi.fn(),
  loadMetadata: vi.fn(),
  clearMetadataCache: vi.fn().mockResolvedValue(undefined),
};

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock }),
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => ({
    status: 'ready',
    countries: [{ code: 'JP', continent: 'AS' }],
  }),
}));

vi.mock('@hierarchidb/ui-dialog', () => ({
  useDialogContext: () => ({
    onStepNavigate: onStepNavigateMock,
  }),
}));

vi.mock('@hierarchidb/ui-worker-client', () => {
  const getBridge = () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getTreeNodeUpdaterAPI: vi.fn().mockResolvedValue({
      getTreeNode: vi.fn().mockResolvedValue({ draftData: {} }),
      updateTreeNode: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    getBuildWorkerBridge: () => getBridge(),
  };
});

vi.mock('comlink', () => ({
  wrap: vi.fn(() => mockWorkerApi),
  proxy: (value: unknown) => value,
}));

type DummyWorker = {
  terminate: () => void;
};

const createDummyWorker = (): DummyWorker => ({
  terminate: vi.fn(),
});

const baseMetadata: CountryMetadata[] = [{
  countryCode: 'JP',
  countryName: 'Japan',
  continent: 'Asia',
  availableAdminLevels: [0],
  iso2: 'JP',
  iso3: 'JPN',
  dataQuality: 'high',
}];

const baseAvailability = {
  dataSource: 'geoboundaries' as const,
  entries: [{ countryCode: 'JPN', adminLevels: [0] }],
  maxAdminLevel: 2,
  source: 'metadata' as const,
  fetchedAt: Date.now(),
};

const buildArgs = (nodeId: NodeId) => ({
  nodeId,
  data: {
    buildConfig: { dataSourceName: 'geoboundaries' as const },
    selectedArrayByCountries: {},
  },
  onChange: onChangeMock,
});

describe('useShapeCountrySelectionStep cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockWorkerApi.setUiStorageBridge.mockResolvedValue(undefined);
    mockWorkerApi.loadMetadata.mockResolvedValue(baseMetadata);
    mockWorkerApi.loadAvailability.mockResolvedValue(baseAvailability);
    (globalThis as { Worker?: unknown }).Worker = vi.fn(() => createDummyWorker()) as typeof Worker;
  });

  it('loads metadata/availability only on first open for same node/dataSource', async () => {
    const { useShapeCountrySelectionStep } = await import('../../../components/country-selection/useShapeCountrySelectionStep');
    const nodeId = 'node-country-1' as NodeId;

    const first = renderHook(() => useShapeCountrySelectionStep(buildArgs(nodeId)));
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    first.unmount();

    const second = renderHook(() => useShapeCountrySelectionStep(buildArgs(nodeId)));
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(mockWorkerApi.loadMetadata).toHaveBeenCalledTimes(1);
    expect(mockWorkerApi.loadAvailability).toHaveBeenCalledTimes(1);
  });

  it('re-fetches metadata/availability when reloadAll is explicitly requested', async () => {
    const { useShapeCountrySelectionStep } = await import('../../../components/country-selection/useShapeCountrySelectionStep');
    const nodeId = 'node-country-2' as NodeId;
    const { result } = renderHook(() => useShapeCountrySelectionStep(buildArgs(nodeId)));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reloadAll();
    });

    expect(mockWorkerApi.loadMetadata).toHaveBeenCalledTimes(2);
    expect(mockWorkerApi.loadMetadata).toHaveBeenLastCalledWith('geoboundaries', nodeId, { force: true });
    expect(mockWorkerApi.loadAvailability).toHaveBeenCalledTimes(2);
    expect(mockWorkerApi.loadAvailability).toHaveBeenLastCalledWith('geoboundaries', nodeId);
  });

  it('does not reuse cache across different nodes', async () => {
    const { useShapeCountrySelectionStep } = await import('../../../components/country-selection/useShapeCountrySelectionStep');
    const firstNodeId = 'node-country-3' as NodeId;
    const secondNodeId = 'node-country-4' as NodeId;

    const first = renderHook(() => useShapeCountrySelectionStep(buildArgs(firstNodeId)));
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    first.unmount();

    const second = renderHook(() => useShapeCountrySelectionStep(buildArgs(secondNodeId)));
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(mockWorkerApi.loadMetadata).toHaveBeenCalledTimes(2);
    expect(mockWorkerApi.loadAvailability).toHaveBeenCalledTimes(2);
  });
});
