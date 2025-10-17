import { PluginStepConfig, PluginStepRegistry, StepComponentProps } from '@hierarchidb/runtime-plugin-dialog';
import { DataSourceStep, isDataSourceComplete, SpreadsheetDialogData } from './steps/DataSourceStep.js';
import { STEP_CONFIG } from '~/common/extension/constants.js';
import { FilteringStep } from './steps/FilteringStep.js';

const registry = PluginStepRegistry.getInstance();

const toDialogData = (value: unknown): Partial<SpreadsheetDialogData> => (
  typeof value === 'object' && value !== null ? value as Partial<SpreadsheetDialogData> : {}
);

registry.registerConfigProvider({
  nodeType: 'spreadsheet',
  getCreateStepConfigs(): PluginStepConfig[] {
    return [
      {
        id: 'data-source',
        label: STEP_CONFIG.DATA_SOURCE.TITLE,
        componentFactory: (props: StepComponentProps) => (
          <DataSourceStep {...props} />
        ),
        validate: (dialogData?: unknown) => isDataSourceComplete(toDialogData(dialogData)),
        capabilities: {
          canProceedToNext: (dialogData?: unknown) => isDataSourceComplete(toDialogData(dialogData)),
        },
      },
      {
        id: 'filtering',
        label: STEP_CONFIG.FILTERING.TITLE,
        componentFactory: (props: StepComponentProps) => (
          <FilteringStep {...props} />
        ),
        validate: () => true,
        optional: STEP_CONFIG.FILTERING.IS_OPTIONAL,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: unknown): PluginStepConfig[] {
    return this.getCreateStepConfigs();
  },
});
