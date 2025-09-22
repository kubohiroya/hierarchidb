import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { RouteSelectionStep } from '../components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../components/RouteProcessingStep.js';
import type { RouteWorkingCopy } from '../types/index.js';

const registry = PluginStepRegistry.getInstance();

type P = StepComponentProps & { data: RouteWorkingCopy };

registry.registerConfigProvider({
  nodeType: 'route',
  getCreateStepConfigs() {
    return [
      {
        id: 'route-selection',
        label: 'Route Selection',
        componentFactory: (p: P) => (
          <RouteSelectionStep
            workingCopy={p.data}
            onUpdate={(updates: Partial<RouteWorkingCopy>) => p.onChange({ ...(p.data || {} as RouteWorkingCopy), ...updates })}
            onValidationChange={p.setValid}
          />
        ),
        validate: () => true,
      },
      {
        id: 'processing',
        label: 'Processing',
        componentFactory: (p: P) => (
          <RouteProcessingStep
            workingCopy={p.data}
            onUpdate={(updates: Partial<RouteWorkingCopy>) => p.onChange({ ...(p.data || {} as RouteWorkingCopy), ...updates })}
            onValidationChange={p.setValid}
          />
        ),
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: any) {
    return this.getCreateStepConfigs();
  },
});
