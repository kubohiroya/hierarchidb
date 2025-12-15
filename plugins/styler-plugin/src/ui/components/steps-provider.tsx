import React from 'react';
import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularDataSourceStep } from '@hierarchidb/spreadsheet-plugin';
import { StylerPreviewStep } from './StylerPreviewStep.tsx';
import type { StylerMapping, StylerStepData } from '../../common/types/StylerEntity.js';
import { i18n } from '@hierarchidb/ui-i18n';
import { StylerMappingStep } from './StylerMappingStep.tsx';
import { hasKeyValueSelected as mappingHasKeyValueSelected } from './useStylerMappingState.ts';
import { StylerFilterStep } from './StylerFilterStep.tsx';

const registry = PluginStepRegistry.getInstance();

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);


const renderMappingStep = (p: StepComponentProps<StylerStepData>) => <StylerMappingStep {...p} />

const hasMappingBasics = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const mapping = (data.mapping ?? {}) as Partial<StylerMapping>;
  const styleType = mapping.styleType;
  const keyColumn = data.keyColumn;
  const valueColumn = data.valueColumn;
  const targetProperty = mapping.targetProperty ?? null;
  return Boolean(keyColumn && valueColumn && styleType && targetProperty);
};

const hasKeyValueSelected = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const keyColumn = data.keyColumn;
  const valueColumn = data.valueColumn;
  const hasLocal = Boolean(keyColumn && valueColumn);
  const hasHook = mappingHasKeyValueSelected(dialogData);
  return hasLocal || hasHook;
};

const hasLoadedDataSource = (dialogData?: StylerStepData): boolean => {
  const data = dialogData as StylerStepData;
  const dataSource = data.dataSource;
  const size =
    typeof dataSource?.sizeBytes === 'number' ? dataSource.sizeBytes : 0;
  return (size ?? 0) > 0;
};

registry.registerConfigProvider<StylerStepData>({
  nodeType: 'styler',
  getCreateStepConfigs(): PluginStepConfig<StylerStepData>[] {
    const t = getStylerT();
    const ensureLoaded: (data?: StylerStepData) => boolean = (dialogData) =>
      hasLoadedDataSource(dialogData);
    const DataSourceWithValidation = (p: StepComponentProps<StylerStepData>) => {
      const valid = ensureLoaded(p.data);
      const lastValidRef = React.useRef<boolean | null>(null);
      React.useEffect(() => {
        if (lastValidRef.current !== valid) {
          lastValidRef.current = valid;
          p.setValid(valid);
        }
      }, [valid, p]);
      return <TabularDataSourceStep {...p} />;
    };
    const FilterWithValidation = (p: StepComponentProps<StylerStepData>) => {
      const valid = ensureLoaded(p.data) && hasKeyValueSelected(p.data);
      const lastValidRef = React.useRef<boolean | null>(null);
      React.useEffect(() => {
        if (lastValidRef.current !== valid) {
          lastValidRef.current = valid;
          p.setValid(valid);
        }
      }, [valid, p]);
      return <StylerFilterStep {...p} />;
    };
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource', 'Data Source'),
        componentFactory: DataSourceWithValidation,
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'style-filter',
        label: t('steps.filtering', 'Filtering'),
        componentFactory: FilterWithValidation,
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'style-mapping',
        label: t('steps.styleSettings', 'Style Mapping'),
        componentFactory: renderMappingStep,
        validate: (dialogData?: StylerStepData) => hasKeyValueSelected(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasKeyValueSelected(dialogData),
        },
      },
      {
        id: 'style-preview',
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
        validate: (dialogData?: StylerStepData) => hasMappingBasics(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasMappingBasics(dialogData),
        },
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
