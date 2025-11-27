import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
// Reuse Spreadsheet steps as Step 2,3
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
  type SpreadsheetDialogData,
} from '@hierarchidb/spreadsheet-plugin';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import { StyleSettingsStep, isStyleSettingsComplete } from './steps/StyleSettingsStep.js';
import { StylerStepData } from '../../common/types/stylerTypes.js';

const registry = PluginStepRegistry.getInstance();

const toSpreadsheetDialogData = (value?: StylerStepData): SpreadsheetDialogData => ({
  ...(value ?? {}),
  metadata: (value?.spreadsheetMetadata ?? null) as SpreadsheetDialogData['metadata'],
});

const mergeDialogData = (
  current: StylerStepData | undefined,
  next: Partial<StylerStepData>
): StylerStepData => ({
  ...(current ?? {}),
  ...next,
  spreadsheetMetadata: next.spreadsheetMetadata ?? current?.spreadsheetMetadata ?? null,
});

const renderDataSourceStep = (p: StepComponentProps<StylerStepData>) => (
  <SpreadsheetDataSourceStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerStepData>),
          spreadsheetMetadata: next.metadata ?? null,
        })
      )
    }
  />
);

const renderFilteringStep = (p: StepComponentProps<StylerStepData>) => (
  <SpreadsheetFilteringStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerStepData>),
          spreadsheetMetadata: next.metadata ?? null,
        })
      )
    }
  />
);

registry.registerConfigProvider<StylerStepData>({
  nodeType: 'styler',
  getCreateStepConfigs() {
    return [
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
        componentFactory: (p: StepComponentProps<StylerStepData>) => (
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
        componentFactory: (p: StepComponentProps<StylerStepData>) => (
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
      {
        id: 'style-settings',
        label: 'Style Settings',
        componentFactory: (p: StepComponentProps<StylerStepData>) => <StyleSettingsStep {...p} />,
        validate: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        },
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
