import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
// Reuse Spreadsheet steps as Step 2,3
import {
  TabularDataSourceStep,
  TabularDataFilterStep,
} from '@hierarchidb/spreadsheet-plugin';
import { StylerConfigStep } from './StylerConfigStep.tsx';
import { StylerPreviewStep } from './StylerPreviewStep.tsx';
import { StylerMappingStep, isStyleMappingComplete } from './StylerMappingStep.tsx';
import { StylerStepData } from '../../common/types/StylerEntity.js';
import { i18n } from '@hierarchidb/ui-i18n';

const registry = PluginStepRegistry.getInstance();

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);


const renderDataSourceStep = (p: StepComponentProps<StylerStepData>) => (
  <TabularDataSourceStep
    {...(p as StepComponentProps<StylerStepData>)}
    data={p.data}
    onChange={
      p.onChange
    }
  />
);

const renderFilteringStep = (p: StepComponentProps<StylerStepData>) => (
  <TabularDataFilterStep
    {...(p as StepComponentProps<StylerStepData>)}
    data={p.data}
    onChange={p.onChange}
  />
);

const hasLoadedDataSource = (dialogData?: StylerStepData): boolean => {
  if (!dialogData || typeof dialogData !== 'object') return false;
  const data = dialogData as StylerStepData;
  const size =
    typeof data.dataSource?.sizeBytes === 'number'
      ? data.dataSource.sizeBytes
      : typeof (data as { tabularTableMetadata?: { fileSizeBytes?: number } }).tabularTableMetadata
          ?.fileSizeBytes === 'number'
        ? (data as { tabularTableMetadata?: { fileSizeBytes?: number } }).tabularTableMetadata
            ?.fileSizeBytes
        : 0;
  return (size ?? 0) > 0;
};

registry.registerConfigProvider<StylerStepData>({
  nodeType: 'styler',
  getCreateStepConfigs(): PluginStepConfig<StylerStepData>[] {
    const t = getStylerT();
    const ensureLoaded: (data?: StylerStepData) => boolean = (dialogData) =>
      hasLoadedDataSource(dialogData);
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource', 'Data Source'),
        componentFactory: renderDataSourceStep,
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'filtering',
        label: t('steps.filtering', 'Filtering'),
        componentFactory: renderFilteringStep,
      },
      {
        id: 'style-settings',
        label: t('steps.styleSettings', 'Style Mapping'),
        componentFactory: (p: StepComponentProps<StylerStepData>) => <StylerMappingStep {...p} />,
        validate: (dialogData?: StylerStepData) =>
          isStyleMappingComplete((dialogData ?? {}) as Partial<StylerStepData>),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) =>
            isStyleMappingComplete((dialogData ?? {}) as Partial<StylerStepData>),
        },
      },
      {
        id: 'style-mapping',
        label: t('steps.styleAlgorithm', 'Style Algorithm'),
        componentFactory: (p: StepComponentProps<StylerStepData>) => (
          <StylerConfigStep
            data={p.data}
            onChange={p.onChange}
            onValidate={(valid) => {
              p.setValid(valid);
              p.setError(
                valid
                  ? null
                  : t('step5.errors.configure', 'Configure styling targets before continuing.')
              );
            }}
          />
        ),
      },
      {
        id: 'preview',
        label: t('steps.preview', 'Preview'),
        componentFactory: (p: StepComponentProps<StylerStepData>) => (
          <StylerPreviewStep
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
