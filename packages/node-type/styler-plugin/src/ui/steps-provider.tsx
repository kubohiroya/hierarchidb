import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import type React from 'react';
import { StylerStep5 } from '../components/steps/StylerStep5';
import { StylerStep6 } from '../components/steps/StylerStep6';
// Reuse Spreadsheet steps as Step 2,3
import { DataSourceStep as SpreadsheetDataSourceStep } from '@hierarchidb/spreadsheet-plugin';
import { FilteringStep as SpreadsheetFilteringStep } from '@hierarchidb/spreadsheet-plugin';

type P = StepComponentProps & { data: any };
const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'styler',
  getCreateStepConfigs() {
    return [
      // Step 2: Spreadsheet Data Source
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (p: P) => (
          <SpreadsheetDataSourceStep data={p.data} onNext={() => void 0} onPrevious={() => void 0} errors={{}} />
        ),
      },
      // Step 3: Spreadsheet Filtering
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: (p: P) => (
          <SpreadsheetFilteringStep data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
        ),
      },
      // Step 4: Styler mapping (original Step2)
      {
        id: 'style-mapping',
        label: 'Style Mapping',
        componentFactory: (p: P) => (
          <StylerStep5 data={p.data} onChange={p.onChange} />
        ),
      },
      // Step 5: Preview (original Step3)
      {
        id: 'preview',
        label: 'Preview',
        componentFactory: (p: P) => (
          <StylerStep6 data={p.data} onChange={p.onChange} />
        ),
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
