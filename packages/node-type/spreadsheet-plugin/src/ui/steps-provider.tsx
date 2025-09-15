// Types-only import to avoid pulling runtime at DTS time
import type { StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { PluginStepRegistry } from '@hierarchidb/runtime-ui-plugin-dialog';
import type React from 'react';
import { DataSourceStep } from '../steps/DataSourceStep';
import { FilteringStep } from '../steps/FilteringStep';

type P = StepComponentProps & { data: any };
const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'spreadsheet',
  getCreateStepConfigs() {
    return [
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (p: P) => (
          <DataSourceStep data={p.data} onNext={() => void 0} onPrevious={() => void 0} errors={{}} />
        ),
        validate: () => true,
      },
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: (p: P) => (
          <FilteringStep data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
        ),
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
