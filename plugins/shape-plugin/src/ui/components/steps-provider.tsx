import type React from 'react';
import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  type ShapeWorkingCopy,
} from '../../common/shared/index.js';
import { Step1BasicInfo } from '../../common/components/steps/Step1BasicInfo.js';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';
import { StepTabularUpload } from '../../common/components/steps/StepTabularUpload.js';
import { StepTabularFilter } from '../../common/components/steps/StepTabularFilter.js';

const registry = PluginStepRegistry.getInstance();

type ShapeDialogStepProps = StepComponentProps<Partial<ShapeWorkingCopy> | undefined>;

function createStepAdapter(
  Component: React.ComponentType<{
    workingCopy: Partial<ShapeWorkingCopy>;
    onUpdate: (updates: Partial<ShapeWorkingCopy>) => void;
    disabled?: boolean;
  }>,
): (props: ShapeDialogStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeDialogStepProps) {
    const workingCopy = (props.data ?? {}) as Partial<ShapeWorkingCopy>;
    const handleUpdate = (updates: Partial<ShapeWorkingCopy>) => {
      props.onChange({
        ...(props.data ?? {}),
        ...updates,
      });
    };

    return (
      <Component
        workingCopy={workingCopy}
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

registry.registerConfigProvider({
  nodeType: 'shape',
  getCreateStepConfigs() {
    return [
      {
        id: 'tabular-upload',
        label: 'Dataset Upload',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularUpload {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'tabular-filter',
        label: 'Dataset Filter',
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularFilter {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (props: ShapeDialogStepProps) => <Step1 {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) => Boolean(data?.name?.trim()),
      },
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: (props: ShapeDialogStepProps) => <Step2 {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) => Boolean(data?.dataSourceName),
      },
      {
        id: 'license-agreement',
        label: 'License Agreement',
        componentFactory: (props: ShapeDialogStepProps) => <Step3 {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) => Boolean(data?.licenseAgreement),
      },
      {
        id: 'processing-configuration',
        label: 'Processing Configuration',
        componentFactory: (props: ShapeDialogStepProps) => <Step4 {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'country-selection',
        label: 'Country Selection',
        componentFactory: (props: ShapeDialogStepProps) => <Step5 {...props} />,
        validate: (data?: Partial<ShapeWorkingCopy>) =>
          summarizeCheckboxState(data?.checkboxState).hasSelection,
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
