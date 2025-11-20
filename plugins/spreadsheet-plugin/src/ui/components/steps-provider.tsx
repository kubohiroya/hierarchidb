import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { SpreadsheetDialogData } from '../../common/types/SpreadsheetEntity.js';
import { DataSourceStep } from './steps/DataSourceStep.js';
import { FilteringStep } from './steps/FilteringStep.js';
import { SPREADSHEET_NODE_TYPE, STEP_LABELS } from '../../common/constants.js';

const registry = PluginStepRegistry.getInstance();

const isComplete = (data?: SpreadsheetDialogData): boolean => Boolean(data?.spreadsheetMetadataId);

registry.registerConfigProvider({
  nodeType: SPREADSHEET_NODE_TYPE,
  getCreateStepConfigs(): PluginStepConfig<SpreadsheetDialogData>[] {
    return [
      {
        id: 'data-source',
        label: STEP_LABELS.dataSource,
        componentFactory: (props: StepComponentProps<SpreadsheetDialogData>) => <DataSourceStep {...props} />,
        validate: (value?: SpreadsheetDialogData) => isComplete(value),
        capabilities: {
          canProceedToNext: (value?: SpreadsheetDialogData) => isComplete(value),
        },
      },
      {
        id: 'filtering',
        label: STEP_LABELS.filtering,
        componentFactory: (props: StepComponentProps<SpreadsheetDialogData>) => <FilteringStep {...props} />,
        optional: true,
      },
    ];
  },
  getEditStepConfigs(): PluginStepConfig<SpreadsheetDialogData>[] {
    return this.getCreateStepConfigs();
  },
});
