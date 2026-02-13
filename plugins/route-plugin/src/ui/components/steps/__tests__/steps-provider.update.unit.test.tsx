import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PluginStepRegistry, type PluginStepProps } from '@hierarchidb/plugin-base';
import type { RouteUpdaterPayload } from '../../../../common/types/index.js';

vi.mock('../RouteDataSourceStep.js', () => ({
  RouteDataSourceStep: (_props: unknown) => null,
}));
vi.mock('../RouteSelectionStep.js', () => ({
  RouteSelectionStep: (_props: unknown) => null,
}));
vi.mock('../RouteProcessingStep.js', () => ({
  RouteProcessingStep: (_props: unknown) => null,
}));
vi.mock('../RouteBuildStep.js', () => ({
  RouteBuildStep: (_props: unknown) => null,
}));
vi.mock('../RoutePreviewStep.js', () => ({
  RoutePreviewStep: (_props: unknown) => null,
}));
vi.mock('../../../../common/i18n/index.js', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
  }),
}));
vi.mock('@hierarchidb/components', () => ({
  notify: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import '../../steps-provider.tsx';

type RouteStepData = PluginStepProps<RouteUpdaterPayload>['data'] & RouteUpdaterPayload;

type RouteDataSourceElement = React.ReactElement<{
  onUpdate: (updates: Partial<RouteUpdaterPayload['draftData']>) => void;
}>;

const getRouteCreateConfigs = () => {
  const registry = PluginStepRegistry.getInstance();
  const provider = registry.getConfigProvider('route');
  if (!provider) {
    throw new Error('Route step config provider is not registered.');
  }
  return provider.getCreateStepConfigs() as ReadonlyArray<{
    id: string;
    componentFactory: (props: PluginStepProps<RouteStepData>) => React.ReactNode;
  }>;
};

const createStepProps = (
  initialData: RouteStepData,
  onChange: (data: RouteStepData) => void,
): PluginStepProps<RouteStepData> => ({
  mode: 'create',
  nodeId: 'route-node',
  parentId: 'parent-node',
  data: initialData,
  onChange,
  onUiStateChange: () => undefined,
  setValid: () => undefined,
  setError: () => undefined,
  disabled: false,
});

describe('route steps provider update merge', () => {
  it('keeps dataSourceName when tabularSourceId is updated afterwards', () => {
    const configs = getRouteCreateConfigs();
    const dataSourceConfig = configs.find((cfg) => cfg.id === 'data-source');
    if (!dataSourceConfig) {
      throw new Error('data-source step config not found');
    }

    let latestData = {} as RouteStepData;
    const element = dataSourceConfig.componentFactory(
      createStepProps({} as RouteStepData, (next) => {
        latestData = next;
      }),
    ) as RouteDataSourceElement;

    element.props.onUpdate({ dataSourceName: 'ide-gsm' });
    element.props.onUpdate({ tabularSourceId: 'tabular-1' });

    expect(latestData.dataSourceName).toBe('ide-gsm');
    expect(latestData.tabularSourceId).toBe('tabular-1');
  });
});
