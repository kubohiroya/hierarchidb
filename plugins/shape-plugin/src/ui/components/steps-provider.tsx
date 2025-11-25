import type React from 'react';
import { PluginStepRegistry, type StartBatchContext, type StepComponentProps } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  type ShapeDraft,
} from '../../common/shared/index.js';
import { Step1BasicInfo } from '../../common/components/steps/Step1BasicInfo.js';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';
import { StepTabularUpload } from '../../common/components/steps/StepTabularUpload.js';
import { StepTabularFilter } from '../../common/components/steps/StepTabularFilter.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type ShapeDialogStepProps = StepComponentProps<Partial<ShapeDraft>>;

function createStepAdapter(
  Component: React.ComponentType<{
    draft: Partial<ShapeDraft>;
    onUpdate: (updates: Partial<ShapeDraft>) => void;
    disabled?: boolean;
  }>,
): (props: ShapeDialogStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeDialogStepProps) {
    const draft = (props.data ?? {}) as Partial<ShapeDraft>;
    const handleUpdate = (updates: Partial<ShapeDraft>) => {
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

const Step1 = createStepAdapter(Step1BasicInfo);
const Step2 = createStepAdapter(Step2DataSource);
const Step3 = createStepAdapter(Step3License);
const Step4 = createStepAdapter(Step4Processing);
const Step5 = createStepAdapter(Step5CountrySelection);

const canStartShapeBatch = (data?: Partial<ShapeDraft>): boolean => {
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasLicense = Boolean(data?.licenseAgreement);
  const hasDataSource = Boolean(data?.dataSourceName);
  const hasName = Boolean((data?.name as string | undefined)?.trim());
  return hasSelection && hasLicense && hasDataSource && hasName;
};

const startShapeBatch = async (data: Partial<ShapeDraft>, _context: StartBatchContext) => {
  if (!canStartShapeBatch(data)) {
    notify.info('Complete required fields and selections before building.');
    return;
  }

  notify.info('Shape batch build is not yet implemented in this dialog.');
};

registry.registerConfigProvider<Partial<ShapeDraft>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    return [
      {
        id: 'tabular-upload',
        label: 'Dataset Upload',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularUpload {...props} />,
        validate: (data?: Partial<ShapeDraft>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'tabular-filter',
        label: 'Dataset Filter',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularFilter {...props} />,
        validate: (data?: Partial<ShapeDraft>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (props: ShapeDialogStepProps) => <Step1 {...props} />,
        validate: (data?: Partial<ShapeDraft>) => Boolean(data?.name?.trim()),
      },
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (props: ShapeDialogStepProps) => <Step2 {...props} />,
        validate: (data?: Partial<ShapeDraft>) => Boolean(data?.dataSourceName),
      },
      {
        id: 'license-agreement',
        label: 'License Agreement',
        componentFactory: (props: ShapeDialogStepProps) => <Step3 {...props} />,
        validate: (data?: Partial<ShapeDraft>) => Boolean(data?.licenseAgreement),
      },
      {
        id: 'processing-configuration',
        label: 'Processing Configuration',
        componentFactory: (props: ShapeDialogStepProps) => <Step4 {...props} />,
        validate: (data?: Partial<ShapeDraft>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'country-selection',
        label: 'Country Selection',
        componentFactory: (props: ShapeDialogStepProps) => <Step5 {...props} />,
        validate: (data?: Partial<ShapeDraft>) =>
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
