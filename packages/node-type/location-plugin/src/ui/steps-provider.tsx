import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { LocationBasicInfoStep } from '../ui/components/LocationBasicInfoStep';
import { LocationSelectionStep } from '../components/steps/LocationSelectionStep';
import type { LocationWorkingCopy } from '../types';

const registry = PluginStepRegistry.getInstance();

type P = StepComponentProps & { data: LocationWorkingCopy };

registry.registerConfigProvider({
  nodeType: 'location',
  getCreateStepConfigs() {
    return [
      {
        id: 'selection', label: 'Location Selection', validate: () => true,
        componentFactory: (p: P) => (
          <LocationSelectionStep
            workingCopy={p.data}
            onUpdate={async (updates) => { p.onChange({ ...(p.data || {} as LocationWorkingCopy), ...updates }); }}
          />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
