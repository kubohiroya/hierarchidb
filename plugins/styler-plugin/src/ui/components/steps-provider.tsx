import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
// Reuse Spreadsheet steps as Step 2,3
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
} from '@hierarchidb/spreadsheet-plugin';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import { StyleSettingsStep, isStyleMappingComplete } from './steps/StyleSettingsStep.js';
import { StylerStepData } from '../../common/types/stylerTypes.js';

const registry = PluginStepRegistry.getInstance();

const mergeDialogData = (
  current: StylerStepData | undefined,
  next: Partial<StylerStepData>
): StylerStepData => ({
  ...(current ?? {}),
  ...next,
});

const renderDataSourceStep = (p: StepComponentProps<StylerStepData>) => (
  <SpreadsheetDataSourceStep
    {...(p as StepComponentProps<StylerStepData>)}
    data={p.data}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerStepData>),
        })
      )
    }
  />
);

const renderFilteringStep = (p: StepComponentProps<StylerStepData>) => (
  <SpreadsheetFilteringStep
    {...(p as StepComponentProps<StylerStepData>)}
    data={p.data}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerStepData>),
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
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: renderFilteringStep,
      },
      {
        id: 'style-settings',
        label: 'Style Mapping',
        componentFactory: (p: StepComponentProps<StylerStepData>) => <StyleSettingsStep {...p} />,
        validate: (dialogData?: unknown) => isStyleMappingComplete(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: unknown) => isStyleMappingComplete(dialogData),
        },
      },
      {
        id: 'style-mapping',
        label: 'Style Algorithm',
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
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
