import type { NodeId, TreeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import type { ShapeEntity } from '../../common/shared/index.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  validateProcessingConfig,
} from '../../common/shared/index.js';
import type { ValidationResult } from '../../common/shared/types.js';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { DialogStepConfig } from '@hierarchidb/plugin-ui-sdk';
import { StepTabularUpload } from '../../common/components/steps/StepTabularUpload.js';
import { StepTabularFilter } from '../../common/components/steps/StepTabularFilter.js';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';

export interface ShapeDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave?: (entity: ShapeEntity) => Promise<void>;
}

export const ShapeDialogHost: React.FC<ShapeDialogProps> = ({
  open,
  mode,
  nodeId,
  parentId,
  treeId,
  onClose,
  onSave,
}) => {
  type ShapeStepProps = StepComponentProps<Partial<ShapeEntity>>;

  const UploadStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <StepTabularUpload
      {...rest}
      mode={mode}
      data={(stepData ?? {}) as ShapeEntity}
      onChange={(patch) =>
        onChange({
          ...(patch ?? {}),
          processingConfig: mergeProcessingConfig(
            (patch as ShapeEntity | null | undefined)?.processingConfig ??
              (stepData as ShapeEntity | null | undefined)?.processingConfig ??
              DEFAULT_PROCESSING_CONFIG
          ),
        } as Partial<ShapeEntity>)
      }
    />
  );

  const FilterStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <StepTabularFilter
      {...rest}
      mode={mode}
      data={(stepData ?? {}) as ShapeEntity}
      onChange={(patch) => onChange(patch ?? {})}
    />
  );

  const DataSourceStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <Step2DataSource
      {...rest}
      draft={(stepData ?? {}) as ShapeEntity}
      onUpdate={(patch) => onChange(patch ?? {})}
      mode={mode}
    />
  );

  const LicenseStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <Step3License
      {...rest}
      draft={(stepData ?? {}) as ShapeEntity}
      onUpdate={(patch) => onChange(patch ?? {})}
    />
  );

  const ProcessingStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <Step4Processing
      {...rest}
      draft={(stepData ?? {}) as ShapeEntity}
      onUpdate={(patch) =>
        onChange({
          ...(patch ?? {}),
          processingConfig: mergeProcessingConfig(
            (patch as ShapeEntity | null | undefined)?.processingConfig ??
              (stepData as ShapeEntity | null | undefined)?.processingConfig ??
              DEFAULT_PROCESSING_CONFIG
          ),
        } as Partial<ShapeEntity>)
      }
      mode={mode}
    />
  );

  const CountryStep: React.FC<ShapeStepProps> = ({ data: stepData, onChange, ...rest }) => (
    <Step5CountrySelection
      {...rest}
      draft={(stepData ?? {}) as ShapeEntity}
      onUpdate={(patch) => onChange(patch ?? {})}
    />
  );

  const { frameStyle, dialogRef, headlessProps, metadata } = useTreeNodeDialog<Partial<ShapeEntity>>({
    open,
    mode,
    nodeType: 'shape',
    nodeId,
    parentId,
    treeId,
    initialDraftData: {
      processingConfig: mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG),
    },
    onClose,
    buildSteps: ({
      data,
      metadata,
      updatePayload,
      persistBasicInfo,
      dialogRef: _dialogRef,
      mode,
      nodeId: _nodeId,
      parentId: _parentId,
    }) => {
      const draftData = data ?? {};
      const validations = validateProcessingConfig(draftData.processingConfig ?? {}) as ValidationResult;

      const steps: DialogStepConfig[] = [
        {
          id: 'basic',
          label: 'Basic Information',
          component: (
            <BasicInfoStep
              name={metadata?.name ?? ''}
              description={metadata?.description ?? ''}
              tags={metadata?.tags ?? []}
              mode={mode}
              onChange={({ name, description, tags }: BasicInfoData) =>
                persistBasicInfo({
                  name,
                  description: description ?? '',
                  tags: tags ?? [],
                })
              }
              validate={(value: BasicInfoData) => (value.name.trim().length ? null : 'Name is required')}
            />
          ),
          validate: () => Boolean(metadata?.name?.trim()),
        },
        {
          id: 'upload',
          label: 'Tabular Upload',
          component: (
            <UploadStep
              data={(draftData ?? {}) as ShapeEntity}
              onChange={(patch) => updatePayload((patch ?? {}) as Partial<ShapeEntity>)}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(draftData.processingConfig?.source),
        },
        {
          id: 'filter',
          label: 'Tabular Filter',
          component: (
            <FilterStep
              data={(draftData ?? {}) as ShapeEntity}
              onChange={(patch) => updatePayload((patch ?? {}) as Partial<ShapeEntity>)}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(validations.filters),
        },
        {
          id: 'source',
          label: 'Data Source',
          component: (
            <DataSourceStep
              data={(draftData ?? {}) as ShapeEntity}
              onChange={(patch) => updatePayload((patch ?? {}) as Partial<ShapeEntity>)}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(validations.data),
        },
        {
          id: 'license',
          label: 'License & Consent',
          component: (
            <LicenseStep
              data={(draftData ?? {}) as ShapeEntity}
              onChange={(patch) => updatePayload((patch ?? {}) as Partial<ShapeEntity>)}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(validations.licenses),
        },
        {
          id: 'process',
          label: 'Processing',
          component: (
            <ProcessingStep
              data={(draftData ?? {}) as ShapeEntity}
              onChange={(patch) => updatePayload((patch ?? {}) as Partial<ShapeEntity>)}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(validations.processing),
        },
        {
          id: 'country',
          label: 'Country Selection',
          component: (
            <CountryStep
              data={draftData}
              onChange={updatePayload}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
              dialogRef={dialogRef}
              mode={mode}
            />
          ),
          validate: () => Boolean(validations.processedData),
        },
      ];

      if (mode === 'edit') {
        const uploadIndex = steps.findIndex(({ id }) => id === 'upload');
        if (uploadIndex !== -1) steps.splice(uploadIndex, 1);
      }

      return steps;
    },
    onSave: async (draftMeta: TreeNodeMetadata, savedId?: NodeId) => {
      const mergedProcessing = mergeProcessingConfig(
        (headlessProps.stepData as Partial<ShapeEntity> | undefined)?.processingConfig ?? DEFAULT_PROCESSING_CONFIG
      );
      const nodeIdToUse = (savedId ?? nodeId) as NodeId;
      const finalMetadata = draftMeta ?? metadata;
      if (onSave) {
        await onSave({
          ...(headlessProps.stepData ?? {}),
          processingConfig: mergedProcessing,
          metadata: finalMetadata,
          nodeId: nodeIdToUse,
        } as ShapeEntity);
      }
    },
  });

  // ensure stepData is Partial for HeadlessMultiStepDialog
  const partialHeadlessProps = {
    ...headlessProps,
    stepData: (headlessProps.stepData ?? {}) as Partial<ShapeEntity>,
  };

  return (
    <div style={frameStyle} role="dialog" aria-modal={open} ref={dialogRef}>
      <HeadlessMultiStepDialog<Partial<ShapeEntity>> {...(partialHeadlessProps as any)} />
    </div>
  );
};

ShapeDialogHost.displayName = 'ShapeDialogHost';
