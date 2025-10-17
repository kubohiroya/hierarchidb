import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';

type P = StepComponentProps & { data: any };
const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'shape',
  getCreateStepConfigs() {
    return [
      { id: 'data-source', label: 'Data Source', componentFactory: (p: P) => (
        <Step2DataSource data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
      ), validate: (data?: any) => !!data?.dataSourceName },
      { id: 'license', label: 'License Agreement', componentFactory: (p: P) => (
        <Step3License data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
      ), validate: (data?: any) => data?.licenseAgreement === true },
      { id: 'processing', label: 'Processing Configuration', componentFactory: (p: P) => (
        <Step4Processing data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
      ), validate: (data?: any) => {
        const levels: number[] | undefined = data?.selectedAdminLevels;
        return Array.isArray(levels) && levels.length > 0 && levels.every((l) => typeof l === 'number' && l >= 0 && l <= 3);
      } },
      { id: 'country', label: 'Country Selection', componentFactory: (p: P) => (
        <Step5CountrySelection data={p.data} onNext={() => void 0} onPrevious={() => void 0} />
      ), validate: (data?: any) => {
        const countries: string[] | undefined = data?.selectedCountries;
        return Array.isArray(countries) && countries.length > 0 && countries.every((c) => typeof c === 'string' && c.length >= 2);
      } },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
