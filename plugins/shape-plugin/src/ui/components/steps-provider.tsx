import type React from 'react';
import { PluginStepRegistry, type StartBatchContext, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  type ShapeDraftData,
} from '../../common/shared/index.js';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';
import { StepTabularUpload } from '../../common/components/steps/StepTabularUpload.js';
import { StepTabularFilter } from '../../common/components/steps/StepTabularFilter.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type ShapeStepData = StepData & Partial<ShapeDraftData>;
type ShapeDialogStepProps = StepComponentProps<ShapeStepData>;

function createStepAdapter(
  Component: React.ComponentType<{
    draft: Partial<ShapeDraftData>;
    onUpdate: (updates: Partial<ShapeDraftData>) => void;
    disabled?: boolean;
  }>,
): (props: ShapeDialogStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeDialogStepProps) {
    const draft = (props.data ?? {}) as Partial<ShapeDraftData>;
    const handleUpdate = (updates: Partial<ShapeDraftData>) => {
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

const Step2 = createStepAdapter(Step2DataSource);
const Step3 = createStepAdapter(Step3License);
const Step4 = createStepAdapter(Step4Processing);
const Step5 = createStepAdapter(Step5CountrySelection);

const canStartShapeBatch = (data?: Partial<ShapeDraftData>): boolean => {
  // data reflects draftData (payload) only
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasLicense = Boolean(data?.licenseAgreement);
  const hasDataSource = Boolean(data?.dataSourceName);
  return hasSelection && hasLicense && hasDataSource;
};

const startShapeBatch = async (data: Partial<ShapeDraftData>, _context: StartBatchContext) => {
  if (!canStartShapeBatch(data)) {
    notify.info('Complete required fields and selections before building.');
    return;
  }

  notify.info('Shape batch build is not yet implemented in this dialog.');
};

registry.registerConfigProvider<Partial<ShapeDraftData>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    return [
      {
        id: 'tabular-upload',
        label: 'Dataset Upload',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularUpload {...props} />,
        validate: (data?: Partial<ShapeDraftData>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'tabular-filter',
        label: 'Dataset Filter',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularFilter {...props} />,
        validate: (data?: Partial<ShapeDraftData>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (props: ShapeDialogStepProps) => <Step2 {...props} />,
        validate: (data?: Partial<ShapeDraftData>) => Boolean(data?.dataSourceName),
      },
      {
        id: 'license-agreement',
        label: 'License Agreement',
        componentFactory: (props: ShapeDialogStepProps) => <Step3 {...props} />,
        validate: (data?: Partial<ShapeDraftData>) => Boolean(data?.licenseAgreement),
      },
      {
        id: 'processing-configuration',
        label: 'Processing Configuration',
        componentFactory: (props: ShapeDialogStepProps) => <Step4 {...props} />,
        validate: (data?: Partial<ShapeDraftData>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'country-selection',
        label: 'Country Selection',
        componentFactory: (props: ShapeDialogStepProps) => <Step5 {...props} />,
        validate: (data?: Partial<ShapeDraftData>) =>
          summarizeCheckboxState(data?.checkboxState).hasSelection,
        capabilities: {
          canStartBatch: canStartShapeBatch,
          startBatch: (data, context) => startShapeBatch(data, context),
        },
      },
    ];
  },
  getEditStepConfigs(_nodeId, _data) {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
