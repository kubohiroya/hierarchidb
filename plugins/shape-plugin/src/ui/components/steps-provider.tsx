import type React from 'react';
import { PluginStepRegistry, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
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
import type { NodeId } from '@hierarchidb/common-types';

const registry = PluginStepRegistry.getInstance();

type ShapeStepData = StepData &
  Partial<ShapeEntity> & {
    treeNodeId?: NodeId;
  };
type ShapeDialogStepProps = StepComponentProps<ShapeStepData>;

function createStepAdapter(Component: React.ComponentType<any>): (props: ShapeDialogStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeDialogStepProps) {
    const draft = (props.data ?? {}) as Partial<ShapeEntity>;
    const handleUpdate = (updates: Partial<ShapeEntity>) => {
      props.onChange({
        ...(props.data ?? {}),
        ...updates,
      });
    };

    return (
      <Component
        draft={draft}
        onUpdate={handleUpdate}
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
  const hasLicense = Boolean(data?.licenseAgreement);
  const hasDataSource = Boolean(data?.dataSourceName);
  return hasSelection && hasLicense && hasDataSource;
};

registry.registerConfigProvider<Partial<ShapeEntity>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: ShapeDialogStepProps) => <ShapeDataSource {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          Boolean(data?.dataSourceName),
      },
      {
        id: 'country-selection',
        label: t('steps.countrySelection.label', 'Country Selection'),
        componentFactory: (props: ShapeDialogStepProps) => <ShapeCountrySelection {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          summarizeCheckboxState(data?.checkboxState).hasSelection,
      },
      {
        id: 'processing-configuration',
        label: t('steps.processing.label', 'Processing Configuration'),
        componentFactory: (props: ShapeDialogStepProps) => <ShapeProcessing {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'build',
        label: t('steps.build.label', 'Build'),
        componentFactory: (props: ShapeDialogStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => canStartShapeBatch(data),
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (props: ShapeDialogStepProps) => <ShapePreview {...props} />,
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId, _data) {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
