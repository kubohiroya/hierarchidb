// Types-only import to avoid pulling runtime at DTS time
import type { PluginStepConfig, StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { PluginStepRegistry } from '@hierarchidb/runtime-ui-plugin-dialog';
import { DataSourceStep } from '../steps/DataSourceStep.js';
import { FilteringStep } from '../steps/FilteringStep.js';

type P = StepComponentProps & { data: any };
const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'spreadsheet',
  getCreateStepConfigs(): PluginStepConfig[] {
    return [
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (p: P) => (
          <DataSourceStep data={p.data} onNext={() => void 0} onPrevious={() => void 0} errors={[]} />
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
  getEditStepConfigs(_nodeId: string, _data?: unknown): PluginStepConfig[] {
    return this.getCreateStepConfigs();
  },
});
