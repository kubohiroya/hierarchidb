import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import { i18n } from '@hierarchidb/ui-i18n';
import { SPREADSHEET_NODE_TYPE } from '~/common/constants';
import type { SpreadsheetDraft } from '~/common/types/SpreadsheetEntity';
import { TabularDataFilterStep } from './steps/TabularDataFilterStep.js';
import { TabularDataSourceStep } from './steps/TabularDataSourceStep.js';

const registry = PluginStepRegistry.getInstance();

const isComplete = (data?: SpreadsheetDraft): boolean => Boolean(data?.spreadsheetMetadataId);
const t = (key: string, defaultValue: string) =>
  i18n.t(key, { defaultValue, ns: 'spreadsheet-plugin' });

registry.registerConfigProvider({
  nodeType: SPREADSHEET_NODE_TYPE,
  getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<SpreadsheetDraft>> {
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: PluginStepProps<SpreadsheetDraft>) => (
          <TabularDataSourceStep {...props} />
        ),
        validate: (data?: SpreadsheetDraft) => isComplete(data),
        capabilities: {
          canProceedToNext: (value?: SpreadsheetDraft) => isComplete(value),
        },
      },
      {
        id: 'filtering',
        label: t('steps.filtering.label', 'Filtering'),
        componentFactory: (props: PluginStepProps<SpreadsheetDraft>) => (
          <TabularDataFilterStep {...props} translationNamespace="spreadsheet-plugin" />
        ),
        optional: true,
        capabilities: {
          canProceedToNext: () => true,
          canSave: () => true,
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(): ReadonlyArray<PluginStepConfig<SpreadsheetDraft>> {
    return this.getCreateStepConfigs();
  },
});
