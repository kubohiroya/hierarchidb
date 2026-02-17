import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import { TabularDataSourceStep } from '@hierarchidb/spreadsheet-plugin';
import { i18n } from '@hierarchidb/ui-i18n';
import React from 'react';
import type { StylerMapping, StylerStepData } from '../../common/types/StylerEntity.js';
import { StylerAlgorithmStep2 } from './StylerAlgorithmStep2.tsx';
import { StylerFilterStep } from './StylerFilterStep.tsx';
import { StylerMappingKeysStep } from './StylerMappingKeysStep.tsx';
import { StylerPreviewStep } from './StylerPreviewStep.tsx';
import { StylerTargetStep } from './StylerTargetStep.tsx';

const registry = PluginStepRegistry.getInstance();

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

const hasMappingBasics = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const mapping = (data.mapping ?? {}) as Partial<StylerMapping>;
  const styleType = mapping.styleType;
  const keyColumn = data.keyColumn;
  const valueColumn = data.valueColumn;
  const targetProperty = mapping.targetProperty ?? null;
  const featureIdProperty = mapping.featureIdProperty ?? '';
  const valueType = mapping.valueType;
  const mappingMode = mapping.mappingMode;
  const hasBehavior = valueType === 'number' ? Boolean(mappingMode) : Boolean(valueType);
  return Boolean(
    keyColumn && valueColumn && styleType && targetProperty && featureIdProperty && hasBehavior
  );
};

const hasMappingKeys = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const keyColumn = data.keyColumn;
  const valueColumn = data.valueColumn;
  const featureIdProperty = data.mapping?.featureIdProperty;
  return Boolean(keyColumn && valueColumn && featureIdProperty);
};

const hasTargetBehavior = (dialogData?: StylerStepData): boolean => {
  const data = dialogData ?? ({} as StylerStepData);
  const mapping = (data.mapping ?? {}) as Partial<StylerMapping>;
  if (!mapping.styleType || !mapping.targetProperty) return false;
  if (!mapping.valueType) return false;
  return mapping.valueType === 'number' ? Boolean(mapping.mappingMode) : true;
};

const hasLoadedDataSource = (dialogData?: StylerStepData): boolean => {
  const data = dialogData as StylerStepData;
  const dataSource = data.dataSource;
  const size = typeof dataSource?.sizeBytes === 'number' ? dataSource.sizeBytes : 0;
  return (size ?? 0) > 0;
};

registry.registerConfigProvider<StylerStepData>({
  nodeType: 'styler',
  getCreateStepConfigs(): PluginStepConfig<StylerStepData>[] {
    const t = getStylerT();
    const ensureLoaded: (data?: StylerStepData) => boolean = (dialogData) =>
      hasLoadedDataSource(dialogData);
    const DataSourceWithValidation = (p: PluginStepProps<StylerStepData>) => {
      const valid = ensureLoaded(p.data);
      const lastValidRef = React.useRef<boolean | null>(null);
      React.useEffect(() => {
        if (lastValidRef.current !== valid) {
          lastValidRef.current = valid;
          p.setValid(valid);
        }
      }, [valid, p]);
      return <TabularDataSourceStep {...p} showPreview={false} />;
    };
    const FilterWithValidation = (p: PluginStepProps<StylerStepData>) => {
      const valid = ensureLoaded(p.data);
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
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: DataSourceWithValidation,
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'style-filter',
        label: t('steps.filtering.label', 'Filtering'),
        componentFactory: FilterWithValidation,
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'mapping-keys',
        label: t('steps.mappingKeys.label', 'Mapping Keys'),
        componentFactory: StylerMappingKeysStep,
        validate: (dialogData?: StylerStepData) => hasMappingKeys(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasMappingKeys(dialogData),
        },
      },
      {
        id: 'target-behavior',
        label: t('steps.target.label', 'Apply Target'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => (
          <StylerTargetStep {...p} showTargetPanel={false} />
        ),
        validate: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        },
      },
      {
        id: 'style-scaling',
        label: t('steps.styleAlgorithm.label', 'Palette'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => <StylerAlgorithmStep2 {...p} />,
        validate: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        },
      },
      {
        id: 'style-preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => (
          <StylerPreviewStep
            data={p.data}
            onChange={p.onChange}
            nodeId={p.nodeId}
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
