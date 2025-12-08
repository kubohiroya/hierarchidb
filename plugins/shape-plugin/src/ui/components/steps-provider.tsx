import type React from 'react';
import { PluginStepRegistry, type StartBatchContext, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  type ShapeEntity,
} from '../../common/shared/index.js';
import { Step2DataSource } from './steps/Step2DataSource.js';
import { Step3License } from './steps/Step3License.js';
import { Step4Processing } from './steps/Step4Processing.js';
import { Step5CountrySelection } from './steps/Step5CountrySelection.js';
import { StepTabularImport } from './steps/StepTabularImport.tsx';
import { StepTabularFilter } from './steps/StepTabularFilter.js';
import { notify } from '@hierarchidb/components';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';

const registry = PluginStepRegistry.getInstance();

type ShapeStepData = StepData & Partial<ShapeEntity>;
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

const Step2 = createStepAdapter(Step2DataSource);
const Step3 = createStepAdapter(Step3License);
const Step4 = createStepAdapter(Step4Processing);
const Step5 = createStepAdapter(Step5CountrySelection);

const canStartShapeBatch = (data?: Partial<ShapeEntity>): boolean => {
  // data reflects draftData (payload) only
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasLicense = Boolean(data?.licenseAgreement);
  const hasDataSource = Boolean(data?.dataSourceName);
  return hasSelection && hasLicense && hasDataSource;
};

const startShapeBatch = async (data: Partial<ShapeEntity>, _context: StartBatchContext) => {
  const { t } = getTranslation();
  if (!canStartShapeBatch(data)) {
    notify.info(t('messages.completeRequired', 'Complete required fields and selections before building.'));
    return;
  }

  notify.info(t('messages.notImplemented', 'Shape batch build is not yet implemented in this dialog.'));
};

registry.registerConfigProvider<Partial<ShapeEntity>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'tabular-upload',
        label: t('steps.tabularUpload.label', 'Dataset Upload'),
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularImport {...props} />,
        validate: (data?: Partial<ShapeEntity>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'tabular-filter',
        label: t('steps.tabularFilter.label', 'Dataset Filter'),
        componentFactory: (props: ShapeDialogStepProps) => <StepTabularFilter {...props} />,
        validate: (data?: Partial<ShapeEntity>) => Boolean(data?.tabularMetadataId),
      },
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: ShapeDialogStepProps) => <Step2 {...props} />,
        validate: (data?: Partial<ShapeEntity>) => Boolean(data?.dataSourceName),
      },
      {
        id: 'license-agreement',
        label: t('steps.licenseAgreement.label', 'License Agreement'),
        componentFactory: (props: ShapeDialogStepProps) => <Step3 {...props} />,
        validate: (data?: Partial<ShapeEntity>) => Boolean(data?.licenseAgreement),
      },
      {
        id: 'processing-configuration',
        label: t('steps.processing.label', 'Processing Configuration'),
        componentFactory: (props: ShapeDialogStepProps) => <Step4 {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          validateProcessingConfig(
            mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'country-selection',
        label: t('steps.countrySelection.label', 'Country Selection'),
        componentFactory: (props: ShapeDialogStepProps) => <Step5 {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
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
