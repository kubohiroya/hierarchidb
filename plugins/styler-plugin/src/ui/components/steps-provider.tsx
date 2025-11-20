import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
// Reuse Spreadsheet steps as Step 2,3
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
  type SpreadsheetDialogData,
} from '@hierarchidb/spreadsheet-plugin';
import type { StylerEntity } from '../../common/types/StylerEntity.js';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import { StyleSettingsStep, isStyleSettingsComplete } from './steps/StyleSettingsStep.js';

type StylerDialogData = SpreadsheetDialogData & Partial<StylerEntity>;

const registry = PluginStepRegistry.getInstance();

const toSpreadsheetDialogData = (value?: StylerDialogData): SpreadsheetDialogData => ({
  ...(value ?? {}),
});

const mergeDialogData = (
  current: StylerDialogData | undefined,
  next: SpreadsheetDialogData
): StylerDialogData => ({
  ...(current ?? {}),
  ...next,
});

const renderDataSourceStep = (p: StepComponentProps<StylerDialogData>) => (
  <SpreadsheetDataSourceStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) => p.onChange(mergeDialogData(p.data, next))}
  />
);

const renderFilteringStep = (p: StepComponentProps<StylerDialogData>) => (
  <SpreadsheetFilteringStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) => p.onChange(mergeDialogData(p.data, next))}
  />
);

registry.registerConfigProvider<StylerDialogData>({
  nodeType: 'styler',
  getCreateStepConfigs() {
    return [
      {
        id: 'style-settings',
        label: 'Style Settings',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => <StyleSettingsStep {...p} />,
        validate: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        },
      },
      // Step 2: Spreadsheet Data Source
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: renderDataSourceStep,
      },
      // Step 3: Spreadsheet Filtering
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: renderFilteringStep,
      },
      // Step 4: Styler mapping (original Step2)
      {
        id: 'style-mapping',
        label: 'Style Mapping',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => (
          <StylerStep5
            data={p.data}
            onChange={p.onChange}
            onValidate={(valid) => {
              p.setValid(valid);
              p.setError(valid ? null : 'Configure styling targets before continuing.');
            }}
          />
        ),
      },
      // Step 5: Preview (original Step3)
      {
        id: 'preview',
        label: 'Preview',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => (
          <StylerStep6
            data={p.data}
            onChange={p.onChange}
            onValidate={(valid) => {
              p.setValid(valid);
              if (valid) {
                p.setError(null);
              }
            }}
          />
        ),
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
