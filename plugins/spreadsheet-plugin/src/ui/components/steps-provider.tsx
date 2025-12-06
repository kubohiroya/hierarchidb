import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { DataSourceStep } from './steps/DataSourceStep.js';
import { FilteringStep } from './steps/FilteringStep.js';
import { SPREADSHEET_NODE_TYPE, STEP_LABELS } from '../../common/constants.js';

const registry = PluginStepRegistry.getInstance();

const isComplete = (data?: SpreadsheetEntity): boolean => Boolean(data?.spreadsheetMetadataId);

registry.registerConfigProvider({
  nodeType: SPREADSHEET_NODE_TYPE,
  getCreateStepConfigs(): PluginStepConfig<SpreadsheetEntity>[] {
    return [
      {
        id: 'data-source',
        label: STEP_LABELS.dataSource,
        componentFactory: (props: StepComponentProps<SpreadsheetEntity>) => <DataSourceStep {...props} />,
        validate: (data?: SpreadsheetEntity) => isComplete(data),
        capabilities: {
          canProceedToNext: (value?: SpreadsheetEntity) => isComplete(value),
        },
      },
      {
        id: 'filtering',
        label: STEP_LABELS.filtering,
        componentFactory: (props: StepComponentProps<SpreadsheetEntity>) => <FilteringStep {...props} />,
        optional: true,
        capabilities: {
          canProceedToNext: () => true,
          canSave: () => true,
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(): PluginStepConfig<SpreadsheetEntity>[] {
    return this.getCreateStepConfigs();
  },
});
