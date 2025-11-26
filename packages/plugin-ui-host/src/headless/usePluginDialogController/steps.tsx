import React, { useCallback, useMemo } from 'react';
import { BasicInfoStep, type DraftData } from '@hierarchidb/plugin-ui-sdk';
import type {
  PluginStepConfig,
  composeStepConfigs,
  StepComponentProps as PluginStepComponentProps,
} from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  DialogStep,
  StepComponentDescriptor,
  StepValidationFn,
  StepComponentProps as HeadlessStepComponentProps,
} from '@hierarchidb/ui-dialog';
import {
  buildStepWorkingData,
  mergeDialogData,
  stripReservedDialogKeys,
  toRecord,
} from '../controller/step-guards.js';
import type {
  StepCompositionResult,
  BasicInfoMeta,
  BasicInfoState,
  DialogStepData,
} from './data-types.js';

type StepAdapterProps = {
  cfg: PluginStepConfig<DialogStepData>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData?: DialogStepData;
  updateDraft: (patch: Partial<DraftData>) => void;
  onDataChange?: (data: DialogStepData) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
  stepProps: HeadlessStepComponentProps<DialogStepData>;
};

const StepAdapterComponent: React.FC<StepAdapterProps> = ({
  cfg,
  mode,
  nodeId,
  parentId,
  workingData,
  updateDraft,
  onDataChange,
  dialogRef,
  stepProps,
}) => {
  const handleChange = useCallback(
    (patch: Partial<DialogStepData>) => {
      const current = toRecord(stepProps.data) ?? workingData ?? {};
      const nextData: DialogStepData = { ...current, ...patch };
      onDataChange?.(nextData);
      updateDraft({ draftData: nextData });
    },
    [onDataChange, stepProps.data, workingData, updateDraft]
  );

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: stepProps.data ?? workingData ?? {},
        disabled: false,
        onChange: handleChange,
        setValid: () => {},
        setError: () => {},
        dialogRef,
      } satisfies PluginStepComponentProps<DialogStepData>)}
    </>
  );
};

interface Params {
  composedConfigs: ReturnType<typeof composeStepConfigs>;
  basicInfo: BasicInfoState;
  setBasicInfo: React.Dispatch<React.SetStateAction<BasicInfoState>>;
  basicInfoMeta: BasicInfoMeta;
  basicInfoValidationError: string | null;
  isBasicInfoValid: boolean;
  tagSuggestions: string[];
  mode: 'create' | 'edit';
  nodeId: NodeId;
  pageNodeId: NodeId;
  draftDataWithoutMeta: DialogStepData;
  updateDraft: (patch: Partial<DraftData>) => void;
  handleBasicInfoBridge: (data: DialogStepData) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
}

export function useDialogSteps({
  composedConfigs,
  basicInfo,
  setBasicInfo,
  basicInfoMeta,
  basicInfoValidationError,
  isBasicInfoValid,
  tagSuggestions,
  mode,
  nodeId,
  pageNodeId,
  draftDataWithoutMeta,
  updateDraft,
 handleBasicInfoBridge,
 dialogRef,
}: Params): StepCompositionResult {
  const normalizedConfigs = useMemo<PluginStepConfig<DialogStepData>[]>(() => {
    return (composedConfigs.configs ?? []).map((cfg) => {
      return {
        ...cfg,
        validate: cfg.validate
          ? (data?: DialogStepData) => Boolean(cfg.validate?.(data ?? {}))
          : undefined,
      };
    });
  }, [composedConfigs.configs]);

  const currentStepData = useMemo<DialogStepData>(
    () => buildStepWorkingData(draftDataWithoutMeta, basicInfo, basicInfoMeta),
    [basicInfo, basicInfoMeta, draftDataWithoutMeta]
  );
  const basicInfoValidationPayload = useMemo<DialogStepData>(
    () => stripReservedDialogKeys(currentStepData),
    [currentStepData]
  );

  const dialogData = useMemo<DialogStepData>(() => mergeDialogData(basicInfo, draftDataWithoutMeta), [
    basicInfo,
    draftDataWithoutMeta,
  ]);

  const steps = useMemo<DialogStep[]>(() => {
    const result: DialogStep[] = [];

    if (!composedConfigs.hasHostBase) {
      result.push({
        id: 'basic-info',
        label: 'Basic Information',
        component: null,
        validate: () => isBasicInfoValid,
      });
    }

    normalizedConfigs.forEach((cfg) => {
      const isBasicInfoStep = cfg.id === 'basic-info';
      const validationPayload = isBasicInfoStep ? basicInfoValidationPayload : draftDataWithoutMeta;
      const validateFn = cfg.validate;
      const resolveValidate: StepValidationFn | undefined = (() => {
        if (isBasicInfoStep) {
          if (validateFn) {
            return () => Boolean(validateFn(validationPayload)) && isBasicInfoValid;
          }
          return () => isBasicInfoValid;
        }
        if (!validateFn) return undefined;
        return () => Boolean(validateFn(validationPayload));
      })();
      result.push({
        id: cfg.id,
        label: cfg.label ?? cfg.id,
        optional: !!cfg.optional,
        validate: resolveValidate,
        component: null,
      });
    });

    return result;
  }, [
    composedConfigs.hasHostBase,
    normalizedConfigs,
    isBasicInfoValid,
    basicInfoValidationPayload,
    draftDataWithoutMeta,
    basicInfoValidationError,
  ]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<DialogStepData>>>(() => {
    const descriptors: StepComponentDescriptor<DialogStepData>[] = [];

    if (!composedConfigs.hasHostBase) {
      const BasicInfoDescriptor: React.FC<HeadlessStepComponentProps<DialogStepData>> = (props) => (
        <BasicInfoStep
          name={basicInfo.name}
          description={basicInfo.description}
          tags={basicInfo.tags}
          tagSuggestions={tagSuggestions}
          onChange={(data: { name: string; description: string; tags?: string[] }) => {
            setBasicInfo((prev) => {
              const next = {
                name: data.name,
                description: data.description ?? '',
                tags: data.tags ?? [],
              };
              if (
                prev.name !== next.name ||
                prev.description !== next.description ||
                prev.tags.join(',') !== next.tags.join(',')
              ) {
                updateDraft({
                  draftMetadata: {
                    name: next.name,
                    description: next.description,
                    tags: next.tags,
                  },
                });
              }
              return next;
            });
            props.onChange({ name: data.name, description: data.description ?? '', tags: data.tags ?? [] });
          }}
          mode={mode}
          validate={() => basicInfoValidationError}
        />
      );
      descriptors.push({
        id: 'basic-info',
        label: 'Basic Information',
        component: BasicInfoDescriptor,
      });
    }

    normalizedConfigs.forEach((cfg) => {
      descriptors.push({
        id: cfg.id,
        label: cfg.label ?? cfg.id,
        component: (stepProps: HeadlessStepComponentProps<DialogStepData>) => (
          <StepAdapterComponent
            cfg={cfg}
            mode={mode}
            nodeId={String(nodeId)}
            parentId={String(pageNodeId)}
            workingData={currentStepData}
            updateDraft={updateDraft}
            onDataChange={cfg.id === 'basic-info' ? handleBasicInfoBridge : undefined}
            dialogRef={dialogRef}
            stepProps={stepProps}
          />
        ),
      });
    });

    return descriptors;
  }, [
    composedConfigs.hasHostBase,
    normalizedConfigs,
    basicInfo.name,
    basicInfo.description,
    basicInfo.tags,
    tagSuggestions,
    mode,
    basicInfoValidationError,
    updateDraft,
    setBasicInfo,
    nodeId,
    pageNodeId,
    currentStepData,
    handleBasicInfoBridge,
    dialogRef,
  ]);

  return {
    steps,
    stepDescriptors,
    currentStepData,
    basicInfoValidationPayload,
    dialogData,
  };
}
