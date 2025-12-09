import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { TabularDataSourceStep } from './steps/TabularDataSourceStep.js';
import { TabularDataFilterStep } from './steps/TabularDataFilterStep.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';
import { i18n } from '@hierarchidb/ui-i18n';

const registry = PluginStepRegistry.getInstance();

const isComplete = (data?: SpreadsheetEntity): boolean => Boolean(data?.spreadsheetMetadataId);
const t = (key: string, defaultValue: string) =>
  i18n.t(key, { defaultValue, ns: 'spreadsheet-plugin' });

registry.registerConfigProvider({
  nodeType: SPREADSHEET_NODE_TYPE,
  getCreateStepConfigs(): PluginStepConfig<SpreadsheetEntity>[] {
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: StepComponentProps<SpreadsheetEntity>) => <TabularDataSourceStep {...props} />,
        validate: (data?: SpreadsheetEntity) => isComplete(data),
        capabilities: {
          canProceedToNext: (value?: SpreadsheetEntity) => isComplete(value),
        },
      },
      {
        id: 'filtering',
        label: t('steps.filtering.label', 'Filtering'),
        componentFactory: (props: StepComponentProps<SpreadsheetEntity>) => <TabularDataFilterStep {...props} />,
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
