import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { RouteEntity } from '@hierarchidb/route-api';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../RouteDataSourceStep.js', () => ({
  RouteDataSourceStep: (_props: unknown) => null,
}));
vi.mock('../RouteSelectionStep.js', () => ({
  RouteSelectionStep: (_props: unknown) => null,
}));
vi.mock('../RouteProcessingStep.js', () => ({
  RouteProcessingStep: (_props: unknown) => null,
}));
vi.mock('../RouteBuildStep/RouteBuildStep.js', () => ({
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

import '../../steps-provider';

type RouteStepData = Partial<RouteEntity>;

type RouteDataSourceElement = React.ReactElement<{
  draft: RouteStepData;
  onUpdate: (updates: RouteStepData) => void;
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
    validate?: (data?: RouteStepData) => boolean;
    capabilities?: {
      canStartBuild?: (data: RouteStepData) => boolean;
    };
  }>;
};

const createStepProps = (
  initialData: RouteStepData,
  onChange: (data: RouteStepData) => void
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

    let latestData: RouteStepData = {};
    const element = dataSourceConfig.componentFactory(
      createStepProps({}, (next) => {
        latestData = next;
      })
    ) as RouteDataSourceElement;

    element.props.onUpdate({ dataSourceName: 'ide-gsm' });
    element.props.onUpdate({ tabularSourceId: 'tabular-1' });
    expect(latestData.dataSourceName).toBe('ide-gsm');
    expect(latestData.tabularSourceId).toBe('tabular-1');
  });

  it('keeps incoming draft data when step is re-opened', () => {
    const configs = getRouteCreateConfigs();
    const dataSourceConfig = configs.find((cfg) => cfg.id === 'data-source');
    if (!dataSourceConfig) {
      throw new Error('data-source step config not found');
    }

    const initialData: RouteStepData = {
      dataSourceName: 'ide-gsm',
      tabularSourceId: 'tabular-1',
      ideGsmFileName: 'routes.csv',
    };
    const element = dataSourceConfig.componentFactory(
      createStepProps(initialData, () => undefined)
    ) as RouteDataSourceElement;

    expect(element.props.draft).toMatchObject(initialData);
  });

  it('does not emit onChange for identical updates', () => {
    const configs = getRouteCreateConfigs();
    const dataSourceConfig = configs.find((cfg) => cfg.id === 'data-source');
    if (!dataSourceConfig) {
      throw new Error('data-source step config not found');
    }

    let changeCount = 0;
    const element = dataSourceConfig.componentFactory(
      createStepProps({ dataSourceName: 'ide-gsm' }, () => {
        changeCount += 1;
      })
    ) as RouteDataSourceElement;

    element.props.onUpdate({ dataSourceName: 'ide-gsm' });
    element.props.onUpdate({ dataSourceName: 'ide-gsm' });

    expect(changeCount).toBe(0);
  });

  it('allows build start for canonical selection-driven routeBuildInput', () => {
    const configs = getRouteCreateConfigs();
    const buildConfig = configs.find((cfg) => cfg.id === 'build');
    const canStartBuild = buildConfig?.capabilities?.canStartBuild;
    if (!canStartBuild) {
      throw new Error('build canStartBuild capability not found');
    }

    expect(
      canStartBuild({
        buildConfig: {},
        routeBuildInput: {
          kind: 'selection-driven',
          routes: [
            {
              startLocationId: 'location-node',
              endLocationId: 'location-node',
              startCoordinates: [139.6917, 35.6895],
              endCoordinates: [135.5023, 34.6937],
              routeMode: 'road',
            },
          ],
        },
      } as RouteStepData)
    ).toBe(true);
  });

  it('allows data-source and build readiness for canonical direct-route input', () => {
    const configs = getRouteCreateConfigs();
    const dataSourceConfig = configs.find((cfg) => cfg.id === 'data-source');
    const buildConfig = configs.find((cfg) => cfg.id === 'build');
    const directRouteData = {
      buildConfig: {},
      routeMode: 'road',
      startLocationId: 'location-node',
      endLocationId: 'location-node',
      lineGeometry: [
        [139.6917, 35.6895],
        [135.5023, 34.6937],
      ],
      routeBuildInput: { kind: 'direct-route' },
    } as RouteStepData;

    expect(dataSourceConfig?.validate?.(directRouteData)).toBe(true);
    expect(buildConfig?.capabilities?.canStartBuild?.(directRouteData)).toBe(true);
  });
});
