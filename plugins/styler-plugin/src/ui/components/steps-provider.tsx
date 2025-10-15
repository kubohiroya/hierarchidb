import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { StylerStep5 } from '../common/components/steps/StylerStep5.js';
import { StylerStep6 } from '../common/components/steps/StylerStep6.js';
// Reuse Spreadsheet steps as Step 2,3
import { DataSourceStep as SpreadsheetDataSourceStep } from '@hierarchidb/spreadsheet-plugin';
import { FilteringStep as SpreadsheetFilteringStep } from '@hierarchidb/spreadsheet-plugin';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'styler',
  getCreateStepConfigs() {
    return [
      // Step 2: Spreadsheet Data Source
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (p: StepComponentProps) => (
          <SpreadsheetDataSourceStep {...p} />
        ),
      },
      // Step 3: Spreadsheet Filtering
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: (p: StepComponentProps) => (
          <SpreadsheetFilteringStep {...p} />
        ),
      },
      // Step 4: Styler mapping (original Step2)
      {
        id: 'style-mapping',
        label: 'Style Mapping',
        componentFactory: (p: StepComponentProps) => (
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
        componentFactory: (p: StepComponentProps) => (
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
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
