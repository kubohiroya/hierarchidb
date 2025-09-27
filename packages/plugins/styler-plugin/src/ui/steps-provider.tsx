import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { StylerStep5 } from '../components/steps/StylerStep5.js';
import { StylerStep6 } from '../components/steps/StylerStep6.js';
// Reuse Spreadsheet steps as Step 2,3
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
} from '@hierarchidb/plugins-spreadsheet-plugin';

type SpreadsheetDataSourceProps = {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
};

type SpreadsheetFilteringProps = {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
};

type ISpreadsheetDataSourceComponent = (props: SpreadsheetDataSourceProps) => JSX.Element;
type ISpreadsheetFilteringComponent = (props: SpreadsheetFilteringProps) => JSX.Element;

const SpreadsheetDataSourceComponent = SpreadsheetDataSourceStep as unknown as ISpreadsheetDataSourceComponent;
const SpreadsheetFilteringComponent = SpreadsheetFilteringStep as unknown as ISpreadsheetFilteringComponent;

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
          <SpreadsheetDataSourceComponent
            data={p.data}
            onNext={(next: unknown) => {
              p.onChange(next);
              p.setValid(true);
              p.setError(null);
            }}
            onPrevious={() => {
              p.setValid(false);
            }}
            errors={[]}
          />
        ),
      },
      // Step 3: Spreadsheet Filtering
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: (p: P) => (
          <SpreadsheetFilteringComponent
            data={p.data}
            onNext={(next: unknown) => {
              p.onChange(next);
              p.setValid(true);
              p.setError(null);
            }}
            onPrevious={() => {
              p.setValid(false);
            }}
            errors={[]}
          />
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
