import type React from 'react';
import { describe, expect, it } from 'vitest';
import { PluginStepRegistry, type PluginStepProps } from '@hierarchidb/plugin-base';
import type { RouteEntity } from '@hierarchidb/route-api';
import '../steps-provider.tsx';

type RouteStepData = Partial<RouteEntity>;

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

describe('route steps provider', () => {
  it('keeps dataSourceName when IDE-GSM tabularSourceId is updated afterwards', () => {
    const configs = getRouteCreateConfigs();
    const dataSourceConfig = configs.find((cfg) => cfg.id === 'data-source');
    if (!dataSourceConfig) {
      throw new Error('data-source step config not found');
    }

    let latestData: RouteStepData = {};
    const element = dataSourceConfig.componentFactory(
      createStepProps({}, (next) => {
        latestData = next;
      }),
    ) as React.ReactElement;

    element.props.onUpdate({ dataSourceName: 'ide-gsm' });
    element.props.onUpdate({ tabularSourceId: 'tabular-1' });

    expect(latestData).toMatchObject({
      dataSourceName: 'ide-gsm',
      tabularSourceId: 'tabular-1',
    });
  });
});
