import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { SpreadsheetDialogData } from '../../common/types/SpreadsheetEntity.js';

type SpreadsheetStepData = StepData & SpreadsheetDialogData;
import { DataSourceStep } from './steps/DataSourceStep.js';
import { FilteringStep } from './steps/FilteringStep.js';
import { SPREADSHEET_NODE_TYPE, STEP_LABELS } from '../../common/constants.js';

const registry = PluginStepRegistry.getInstance();

const isComplete = (data?: SpreadsheetDialogData): boolean => Boolean(data?.spreadsheetMetadataId);

registry.registerConfigProvider({
  nodeType: SPREADSHEET_NODE_TYPE,
  getCreateStepConfigs(): PluginStepConfig<SpreadsheetStepData>[] {
    return [
      {
        id: 'data-source',
        label: STEP_LABELS.dataSource,
        componentFactory: (props: StepComponentProps<SpreadsheetStepData>) => <DataSourceStep {...props} />,
        validate: (value?: SpreadsheetStepData) => isComplete(value),
        capabilities: {
          canProceedToNext: (value?: SpreadsheetStepData) => isComplete(value),
        },
      },
      {
        id: 'filtering',
        label: STEP_LABELS.filtering,
        componentFactory: (props: StepComponentProps<SpreadsheetStepData>) => <FilteringStep {...props} />,
        optional: true,
      },
    ];
  },
  getEditStepConfigs(): PluginStepConfig<SpreadsheetStepData>[] {
    return this.getCreateStepConfigs();
  },
});
