import React from 'react';
import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import {
  TabularDataSourceStep,
  TabularDataFilterStep,
} from '@hierarchidb/spreadsheet-plugin';
import { StylerConfigStep } from './StylerConfigStep.tsx';
import { StylerPreviewStep } from './StylerPreviewStep.tsx';
import type { StylerMapping, StylerStepData } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { i18n } from '@hierarchidb/ui-i18n';
import { StylerMappingStep } from './StylerMappingStep.tsx';
import { isStyleMappingComplete } from './useStylerMappingState.ts';

const registry = PluginStepRegistry.getInstance();

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);


const renderMappingStep = (p: StepComponentProps<StylerStepData>) => <StylerMappingStep {...p} />

const hasMappingBasics = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const mapping = (data.mapping ?? {}) as Partial<StylerMapping>;
  const styleType =
    mapping.styleType ??
    (data.stylerConfig as { styleType?: StylerMapping['styleType'] } | undefined)?.styleType ??
    (data as { styleType?: string }).styleType;
  const keyColumn = mapping.keyColumn ?? data.selectedKeyColumn ?? (data.stylerConfig as { keyColumn?: string } | undefined)?.keyColumn;
  const valueColumn =
    mapping.valueColumn ??
    data.selectedValueColumn ??
    (data.stylerConfig as { valueColumn?: string } | undefined)?.valueColumn;
  const targetProperty = mapping.targetProperty ?? null;
  return Boolean(keyColumn && valueColumn && styleType && targetProperty);
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
      // Ensure initial render updates Next disabled state
      React.useEffect(() => {
        p.setValid(valid);
      }, [valid, p]);
      p.setValid(valid);
      return <TabularDataSourceStep {...p} />;
    };
    const FilterWithValidation = (p: StepComponentProps<StylerStepData>) => {
      const valid = ensureLoaded(p.data);
      React.useEffect(() => {
        p.setValid(valid);
      }, [valid, p]);
      p.setValid(valid);
      return <TabularDataFilterStep {...p} />;
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
        validate: (dialogData?: StylerStepData) =>
          isStyleMappingComplete((dialogData ?? {}) as Partial<StylerStepData>),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) =>
            isStyleMappingComplete((dialogData ?? {}) as Partial<StylerStepData>),
        },
      },
      {
        id: 'style-config',
        label: t('steps.styleAlgorithm', 'Style Algorithm'),
        componentFactory: (p: StepComponentProps<StylerStepData>) => (
          <StylerConfigStep
            data={p.data}
            onChange={p.onChange}
            onValidate={(rangeValid) => {
              const mappingValid = hasMappingBasics(p.data);
              const valid = Boolean(rangeValid && mappingValid);
              p.setValid(valid);
              p.setError(
                valid
                  ? null
                  : t('step5.errors.configure', 'Configure styling targets before continuing.')
              );
            }}
          />
        ),
        validate: (dialogData?: StylerStepData) => {
          const data = dialogData ?? ({} as StylerStepData);
          const cfg = data.stylerConfig ?? StylerConfigDefault;
          const rangeValid = cfg.min < cfg.max;
          return rangeValid && hasMappingBasics(data);
        },
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => {
            const data = dialogData ?? ({} as StylerStepData);
            const cfg = data.stylerConfig ?? StylerConfigDefault;
            const rangeValid = cfg.min < cfg.max;
            return rangeValid && hasMappingBasics(data);
          },
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
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
