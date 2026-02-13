import { describe, expect, it, vi } from 'vitest';
import { PluginStepRegistry } from '@hierarchidb/plugin-base';

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

const getDataSourceValidate = () => {
  const provider = PluginStepRegistry.getInstance().getConfigProvider('route');
  if (!provider) {
    throw new Error('route config provider is not registered');
  }
  const steps = provider.getCreateStepConfigs();
  const dataSourceStep = steps.find((step) => step.id === 'data-source');
  if (!dataSourceStep?.validate) {
    throw new Error('route data-source validate function is missing');
  }
  return dataSourceStep.validate;
};

describe('route steps-provider data-source validation', () => {
  it('treats ide-gsm source without tabularSourceId as invalid', () => {
    const validate = getDataSourceValidate();
    const valid = validate({
      dataSourceName: 'ide-gsm',
    });
    expect(valid).toBe(false);
  });

  it('treats ide-gsm source with tabularSourceId as valid', () => {
    const validate = getDataSourceValidate();
    const valid = validate({
      dataSourceName: 'ide-gsm',
      tabularSourceId: 'route-tabular-1',
    });
    expect(valid).toBe(true);
  });
});
