import type React from 'react';
import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  type ShapeEntity,
} from '../../common/types/index.js';
import { ShapeDataSourceStep } from './steps/ShapeDataSourceStep.js';
import { ShapeProcessingSettingsStep } from './steps/ShapeProcessingSettingsStep.js';
import { ShapeCountrySelectionStep } from './steps/ShapeCountrySelectionStep.js';
import { ShapePreviewStep } from './steps/ShapePreviewStep.js';
import { ShapeBuildProgressStep } from './steps/ShapeBuildProgressStep.js';
import { useTranslation as getTranslation } from '../../ui/i18n.js';
import type { ShapeDialogStepProps } from './steps/ShapeDialogStepProps.js';


const registry = PluginStepRegistry.getInstance();

type ShapeStepProps = PluginStepProps<ShapeEntity>;

function createStepAdapter(
  Component: React.ComponentType<ShapeDialogStepProps>,
): (props: ShapeStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeStepProps) {
    const data = (props.data ?? {}) as Partial<ShapeEntity>;
    const handleChange = (updates: Partial<ShapeEntity>) => {
      props.onChange({
        ...(props.data ?? {}),
        ...updates,
      });
    };

    return (
      <Component
        data={data}
        onChange={handleChange}
        disabled={Boolean(props.disabled)}
      />
    );
  };
}

const ShapeDataSource = createStepAdapter(ShapeDataSourceStep);
const ShapeProcessing = createStepAdapter(ShapeProcessingSettingsStep);
const ShapeCountrySelection = createStepAdapter(ShapeCountrySelectionStep);
const ShapePreview = createStepAdapter(ShapePreviewStep);
const ShapeBuildProgress = createStepAdapter(ShapeBuildProgressStep);

const canStartShapeBatch = (data?: Partial<ShapeEntity>): boolean => {
  // data reflects draftData (payload) only
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasDataSource = Boolean(data?.dataSourceName);
  const processingValid = validateProcessingConfig(
    mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
  ).isValid;
  return hasSelection && hasDataSource && processingValid;
};

registry.registerConfigProvider<Partial<ShapeEntity>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: ShapeStepProps) => <ShapeDataSource {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          Boolean(data?.dataSourceName),
      },
      {
        id: 'country-selection',
        label: t('steps.countrySelection.label', 'Country Selection'),
        componentFactory: (props: ShapeStepProps) => <ShapeCountrySelection {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          summarizeCheckboxState(data?.checkboxState).hasSelection,
      },
      {
        id: 'processing-configuration',
        label: t('steps.processing.label', 'Processing Configuration'),
        componentFactory: (props: ShapeStepProps) => <ShapeProcessing {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'build',
        label: t('steps.build.label', 'Build'),
        componentFactory: (props: ShapeStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => canStartShapeBatch(data),
        capabilities: {
          canStartBatch: (data?: Partial<ShapeEntity>) => canStartShapeBatch(data),
        },
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (props: ShapeStepProps) => <ShapePreview {...props} />,
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId, _data) {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
