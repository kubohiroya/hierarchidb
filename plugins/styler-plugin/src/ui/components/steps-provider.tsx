import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import { TabularDataSourceStep } from '@hierarchidb/spreadsheet-plugin/ui';
import { i18n } from '@hierarchidb/ui-i18n';
import React from 'react';
import type {
  SpreadSheetDataSourceType,
  StylerMapping,
  StylerStepData,
} from '~/common/types/StylerEntity';
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

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const mergeStylerDraft = (
  current: StylerStepData,
  updates: Partial<StylerStepData>
): StylerStepData => {
  const next: StylerStepData = {
    ...current,
    ...updates,
  };
  if (Object.prototype.hasOwnProperty.call(updates, 'mapping')) {
    next.mapping = {
      ...(current.mapping ?? {}),
      ...(updates.mapping ?? {}),
    } as StylerStepData['mapping'];
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'stylerConfig')) {
    next.stylerConfig = {
      ...(current.stylerConfig ?? {}),
      ...(updates.stylerConfig ?? {}),
    } as StylerStepData['stylerConfig'];
  }
  return next;
};

const createDraftUpdater = (
  initial: StylerStepData,
  onChange: PluginStepProps<StylerStepData>['onChange']
) => {
  let latestDraft: StylerStepData = { ...(initial ?? {}) };
  let latestSignature = serializeComparable(latestDraft);

  return (updates: Partial<StylerStepData>) => {
    const nextDraft = mergeStylerDraft(latestDraft, updates);
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(nextDraft);
  };
};

const isUrlSource = (dialogData?: StylerStepData): boolean => {
  const source = dialogData?.dataSource?.source;
  if (dialogData?.dataSource?.type === 'url') return true;
  return typeof source === 'string' && /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(source);
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
  const hasUrlLikeSource =
    typeof dataSource?.source === 'string' &&
    /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(dataSource.source);
  const hasSpreadsheetMetadata = Boolean(data.spreadsheetMetadataId);
  const isUrlMode = dataSource?.type === 'url';
  if (isUrlMode) {
    return hasSpreadsheetMetadata && hasUrlLikeSource && size > 0;
  }
  return size > 0 && hasSpreadsheetMetadata;
};

const hasDownloadedUrlSource = (dialogData?: StylerStepData): boolean => {
  if (!isUrlSource(dialogData)) {
    return false;
  }
  const dataSource = (dialogData?.dataSource ?? {}) as Partial<SpreadSheetDataSourceType>;
  const size = typeof dataSource.sizeBytes === 'number' ? dataSource.sizeBytes : 0;
  return Boolean(dialogData?.spreadsheetMetadataId && size > 0);
};

const canStartStylerAutoBuild = (dialogData?: StylerStepData): boolean => {
  const dataSource = dialogData?.dataSource;
  if (dataSource?.type === 'file') return false;
  if (!isUrlSource(dialogData)) return false;
  return !hasDownloadedUrlSource(dialogData);
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
        componentFactory: (p: PluginStepProps<StylerStepData>) => {
          const draft = p.data ?? ({} as StylerStepData);
          return (
            <DataSourceWithValidation
              {...p}
              data={draft}
              onChange={createDraftUpdater(draft, p.onChange)}
            />
          );
        },
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canStartBuild: canStartStylerAutoBuild,
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'style-filter',
        label: t('steps.filtering.label', 'Filtering'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => {
          const draft = p.data ?? ({} as StylerStepData);
          return (
            <FilterWithValidation
              {...p}
              data={draft}
              onChange={createDraftUpdater(draft, p.onChange)}
            />
          );
        },
        validate: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        capabilities: {
          canProceedToNext: ensureLoaded as PluginStepConfig<StylerStepData>['validate'],
        },
      },
      {
        id: 'mapping-keys',
        label: t('steps.mappingKeys.label', 'Mapping Keys'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => {
          const draft = p.data ?? ({} as StylerStepData);
          return (
            <StylerMappingKeysStep
              {...p}
              data={draft}
              onChange={createDraftUpdater(draft, p.onChange)}
            />
          );
        },
        validate: (dialogData?: StylerStepData) => hasMappingKeys(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasMappingKeys(dialogData),
        },
      },
      {
        id: 'target-behavior',
        label: t('steps.target.label', 'Apply Target'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => (
          <StylerTargetStep
            {...p}
            data={p.data ?? ({} as StylerStepData)}
            onChange={createDraftUpdater(p.data ?? ({} as StylerStepData), p.onChange)}
            showTargetPanel={false}
          />
        ),
        validate: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        },
      },
      {
        id: 'style-scaling',
        label: t('steps.styleAlgorithm.label', 'Palette'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => {
          const draft = p.data ?? ({} as StylerStepData);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return <StylerAlgorithmStep2 {...p} data={draft} onChange={handleUpdate} />;
        },
        validate: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: StylerStepData) => hasTargetBehavior(dialogData),
        },
      },
      {
        id: 'style-preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (p: PluginStepProps<StylerStepData>) => {
          const draft = p.data ?? ({} as StylerStepData);
          return (
            <StylerPreviewStep
              data={draft}
              onChange={createDraftUpdater(draft, p.onChange)}
              nodeId={p.nodeId}
              onValidate={(valid) => {
                p.setValid(valid);
                if (valid) {
                  p.setError(null);
                }
              }}
            />
          );
        },
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
