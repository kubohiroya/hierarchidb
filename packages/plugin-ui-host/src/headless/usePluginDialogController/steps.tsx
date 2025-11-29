import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { BasicInfoStep } from '@hierarchidb/plugin-ui-sdk';
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
  DialogUiState,
} from './data-types.js';

type StepAdapterProps = {
  cfg: PluginStepConfig<DialogStepData, DialogUiState>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  uiState: DialogUiState;
  setDraftData: React.Dispatch<React.SetStateAction<DialogStepData>>;
  updateUiState: (next: DialogUiState) => void;
  onDataChange?: (data: DialogStepData) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
  stepProps: HeadlessStepComponentProps<DialogStepData>;
};

const StepAdapterComponent: React.FC<StepAdapterProps> = ({
  cfg,
  mode,
  nodeId,
  parentId,
  uiState,
  setDraftData,
  updateUiState,
  onDataChange,
  dialogRef,
  stepProps,
}) => {
  const draftAtom = useMemo(() => atom(stepProps.data ?? {}), [stepProps.data]);
  const [, setSlice] = useAtom(draftAtom);

  useEffect(() => {
    setSlice(toRecord(stepProps.data) ?? {});
  }, [setSlice, stepProps.data]);

  const handleChange = useCallback(
    (patch: Partial<DialogStepData>) => {
      const current = toRecord(stepProps.data) ?? {};
      const nextData: DialogStepData = { ...current, ...patch };
      onDataChange?.(nextData);
      setSlice(nextData);
      setDraftData(nextData);
    },
    [onDataChange, stepProps.data, setDraftData, setSlice]
  );

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: stepProps.data ?? {},
        uiState,
        disabled: false,
        onChange: handleChange,
        onUiStateChange: updateUiState,
        setValid: () => {},
        setError: () => {},
        dialogRef,
      } satisfies PluginStepComponentProps<DialogStepData, DialogUiState>)}
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
  draftData: DialogStepData;
  setDraftData: React.Dispatch<React.SetStateAction<DialogStepData>>;
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
  draftData,
  setDraftData,
  handleBasicInfoBridge,
  dialogRef,
}: Params): StepCompositionResult {
  const [uiState, setUiState] = useState<DialogUiState>({});
  const [draftAtom] = useState(() => atom(draftData));
  const [, setDraftAtomValue] = useAtom(draftAtom);

  useEffect(() => {
    setDraftAtomValue(draftData);
  }, [draftData, setDraftAtomValue]);
  const normalizedConfigs = useMemo<PluginStepConfig<DialogStepData, DialogUiState>[]>(() => {
    return (composedConfigs.configs ?? []).map(
      (cfg: PluginStepConfig<DialogStepData, DialogUiState>) => ({
        ...cfg,
        validate: cfg.validate
          ? (data?: DialogStepData) => Boolean(cfg.validate?.(data ?? {}))
          : undefined,
      })
    );
  }, [composedConfigs.configs]);

  const currentStepData = useMemo<DialogStepData>(() => buildStepWorkingData(draftData, basicInfo, basicInfoMeta), [
    basicInfo,
    basicInfoMeta,
    draftData,
  ]);
  const basicInfoValidationPayload = useMemo<DialogStepData>(
    () => stripReservedDialogKeys(currentStepData),
    [currentStepData]
  );

  const dialogData = useMemo<DialogStepData>(() => mergeDialogData(basicInfo, draftData), [
    basicInfo,
    draftData,
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
      const validationPayload = isBasicInfoStep ? basicInfoValidationPayload : draftData;
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
  }, [composedConfigs.hasHostBase, normalizedConfigs, isBasicInfoValid, basicInfoValidationPayload, draftData]);

  const handleBasicInfoChange = useCallback(
    (data: { name: string; description: string; tags?: string[] }) => {
      setBasicInfo(() => {
        const next = {
          name: data.name,
          description: data.description ?? '',
          tags: data.tags ?? [],
        };
        return next;
      });
    },
    [setBasicInfo]
  );

  const nameAtom = useMemo(
    () =>
      atom(
        (get) => (get(draftAtom) as { name?: string })?.name ?? '',
        (get, set, val: string) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, name: val });
        }
      ),
    [draftAtom]
  );
  const descriptionAtom = useMemo(
    () =>
      atom(
        (get) => (get(draftAtom) as { description?: string })?.description ?? '',
        (get, set, val: string) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, description: val });
        }
      ),
    [draftAtom]
  );
  const tagsAtom = useMemo(
    () =>
      atom(
        (get) => (get(draftAtom) as { tags?: string[] })?.tags ?? [],
        (get, set, val: string[]) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, tags: val });
        }
      ),
    [draftAtom]
  );

  const basicInfoDescriptor = useMemo<StepComponentDescriptor<DialogStepData> | null>(() => {
    if (composedConfigs.hasHostBase) return null;

    const Component: React.FC<HeadlessStepComponentProps<DialogStepData>> = React.memo((props) => {
      const [name, setName] = useAtom(nameAtom);
      const [description, setDescription] = useAtom(descriptionAtom);
      const [tags, setTags] = useAtom(tagsAtom);

      const handleChange = useCallback(
        (data: { name: string; description: string; tags?: string[] }) => {
          const nextTags = data.tags ?? [];
          setName(data.name);
          setDescription(data.description ?? '');
          setTags(nextTags);
          handleBasicInfoChange(data);
          props.onChange({ name: data.name, description: data.description ?? '', tags: nextTags });
        },
        [props, setName, setDescription, setTags]
      );

      return (
        <BasicInfoStep
          name={name}
          description={description}
          tags={tags}
          tagSuggestions={tagSuggestions}
          onChange={handleChange}
          mode={mode}
          validate={() => basicInfoValidationError}
        />
      );
    });
    return { id: 'basic-info', label: 'Basic Information', component: Component };
  }, [composedConfigs.hasHostBase, nameAtom, descriptionAtom, tagsAtom, tagSuggestions, handleBasicInfoChange, mode, basicInfoValidationError]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<DialogStepData>>>(() => {
    const descriptors: StepComponentDescriptor<DialogStepData>[] = [];

    if (basicInfoDescriptor) {
      descriptors.push(basicInfoDescriptor);
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
            uiState={uiState}
            setDraftData={setDraftData}
            updateUiState={setUiState}
            onDataChange={cfg.id === 'basic-info' ? handleBasicInfoBridge : undefined}
            dialogRef={dialogRef}
            stepProps={stepProps}
          />
        ),
      });
    });

    return descriptors;
  }, [
    basicInfoDescriptor,
    normalizedConfigs,
    mode,
    nodeId,
    pageNodeId,
    uiState,
    setDraftData,
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
