import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { BasicInfoStep } from '@hierarchidb/plugin-ui-sdk';
import type {
  PluginStepConfig,
  composeStepConfigs,
  StepComponentProps as PluginStepComponentProps,
} from '@hierarchidb/plugin-base';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type {
  DialogStep,
  StepComponentDescriptor,
  StepValidationFn,
  StepComponentProps as HeadlessStepComponentProps,
} from '@hierarchidb/ui-dialog';
import { buildStepWorkingData, mergeDialogData, toRecord } from '../controller/step-guards.js';
import type {
  StepCompositionResult,
  BasicInfoMeta,
  DialogUiState,
} from './data-types.js';

type PluginDefinedEntity = object;

type StepAdapterProps = {
  cfg: PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  basicInfo: TreeNodeMetadata;
  uiState: DialogUiState;
  setDraftData: React.Dispatch<React.SetStateAction<Partial<PluginDefinedEntity>>>;
  updateUiState: (next: DialogUiState) => void;
  onDataChange?: (data: TreeNodeMetadata | Partial<PluginDefinedEntity>) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
  stepProps: HeadlessStepComponentProps<Partial<PluginDefinedEntity>>;
  stepData: TreeNodeMetadata | Partial<PluginDefinedEntity>
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
  stepData,
}) => {
  const isBasicInfoStep = cfg.id === 'basic-info';
  const draftAtom = useMemo(() => atom(stepData), [stepData]);
  const [, setSlice] = useAtom(draftAtom);

  useEffect(() => {
    setSlice(toRecord(stepData) ?? {});
  }, [setSlice, stepData]);

  const handleChange = useCallback(
    (patch: TreeNodeMetadata | Partial<PluginDefinedEntity>) => {
      const current = toRecord(stepData) ?? {};
      const nextData: Partial<PluginDefinedEntity> = { ...current, ...(patch as object) };
      onDataChange?.(nextData);
      setSlice(nextData);
      if (!isBasicInfoStep) {
        const { name, description, tags, ...rest } = nextData as Record<string, unknown>;
        void name;
        void description;
        void tags;
        setDraftData(rest as Partial<PluginDefinedEntity>);
      }
    },
    [isBasicInfoStep, onDataChange, stepData, setDraftData, setSlice]
  );

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: stepData ?? {},
        uiState,
        disabled: false,
        onChange: handleChange,
        onUiStateChange: updateUiState,
        setValid: () => {},
        setError: () => {},
        dialogRef,
      } satisfies PluginStepComponentProps<Partial<PluginDefinedEntity>, DialogUiState>)}
    </>
  );
};

interface Params {
  composedConfigs: ReturnType<typeof composeStepConfigs>;
  basicInfo: TreeNodeMetadata;
  setBasicInfo: React.Dispatch<React.SetStateAction<TreeNodeMetadata>>;
  basicInfoMeta: BasicInfoMeta;
  basicInfoValidationError: string | null;
  isBasicInfoValid: boolean;
  tagSuggestions: string[];
  mode: 'create' | 'edit';
  nodeId: NodeId;
  pageNodeId: NodeId;
  draftData: Partial<PluginDefinedEntity>;
  setDraftData: React.Dispatch<React.SetStateAction<Partial<PluginDefinedEntity>>>;
  handleBasicInfoBridge: (data: TreeNodeMetadata) => void;
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
}: Params): StepCompositionResult<PluginDefinedEntity> {
  const [uiState, setUiState] = useState<DialogUiState>({});
  const [draftAtom] = useState(() => atom(buildStepWorkingData(draftData, basicInfo, basicInfoMeta)));
  const [, setDraftAtomValue] = useAtom(draftAtom);

  useEffect(() => {
    setDraftAtomValue(buildStepWorkingData(draftData, basicInfo, basicInfoMeta));
  }, [draftData, basicInfo, basicInfoMeta, setDraftAtomValue]);
  const normalizedConfigs = useMemo<PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>[]>(() => {
    return (composedConfigs.configs ?? []).map(
      (cfg: PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>) => ({
        ...cfg,
        validate: cfg.validate
          ? (data?: Partial<PluginDefinedEntity>) => Boolean(cfg.validate?.(data ?? {}))
          : undefined,
      })
    );
  }, [composedConfigs.configs]);

  const currentStepData = useMemo<Partial<PluginDefinedEntity>>(
    () => buildStepWorkingData(draftData, basicInfo, basicInfoMeta),
    [basicInfo, basicInfoMeta, draftData]
  );
  const basicInfoValidationPayload = useMemo<TreeNodeMetadata>(() => basicInfo, [basicInfo]);

  const dialogData = useMemo<Partial<PluginDefinedEntity>>(
    () => mergeDialogData(basicInfo, draftData),
    [basicInfo, draftData]
  );

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
        (get) => (get(draftAtom) as { name?: string })?.name ?? basicInfo.name ?? '',
        (get, set, val: string) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, name: val });
        }
      ),
    [draftAtom, basicInfo.name]
  );
  const descriptionAtom = useMemo(
    () =>
      atom(
        (get) =>
          (get(draftAtom) as { description?: string })?.description ??
          basicInfo.description ??
          '',
        (get, set, val: string) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, description: val });
        }
      ),
    [draftAtom, basicInfo.description]
  );
  const tagsAtom = useMemo(
    () =>
      atom(
        (get) => (get(draftAtom) as { tags?: string[] })?.tags ?? basicInfo.tags ?? [],
        (get, set, val: string[]) => {
          const prev = (get(draftAtom) as any) ?? {};
          set(draftAtom, { ...prev, tags: val });
        }
      ),
    [draftAtom, basicInfo.tags]
  );

  const basicInfoDescriptor = useMemo<StepComponentDescriptor<Partial<PluginDefinedEntity>> | null>(() => {
    if (composedConfigs.hasHostBase) return null;

    const Component: React.FC<HeadlessStepComponentProps<Partial<PluginDefinedEntity>>> = React.memo(
      (props) => {
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
      }
    );
    return { id: 'basic-info', label: 'Basic Information', component: Component };
  }, [composedConfigs.hasHostBase, nameAtom, descriptionAtom, tagsAtom, tagSuggestions, handleBasicInfoChange, mode, basicInfoValidationError]);

  const stepDescriptors = useMemo<
    ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>>
  >(() => {
    const descriptors: StepComponentDescriptor<Partial<PluginDefinedEntity>>[] = [];

    if (basicInfoDescriptor) {
      descriptors.push(basicInfoDescriptor);
    }

    normalizedConfigs.forEach((cfg) => {
      descriptors.push({
        id: cfg.id,
        label: cfg.label ?? cfg.id,
        component: (stepProps: HeadlessStepComponentProps<Partial<PluginDefinedEntity>>) => (
          <StepAdapterComponent
            cfg={cfg}
        mode={mode}
        nodeId={String(nodeId)}
        parentId={String(pageNodeId)}
        basicInfo={basicInfo}
        uiState={uiState}
        setDraftData={setDraftData}
        updateUiState={setUiState}
        onDataChange={
          cfg.id === 'basic-info'
            ? (data) => handleBasicInfoBridge(data as TreeNodeMetadata)
            : undefined
        }
        dialogRef={dialogRef}
        stepProps={stepProps}
        stepData={cfg.id === 'basic-info' ? basicInfo : stepProps.data ?? {}}
      />
    ),
      });
    });

    return descriptors;
  }, [
    basicInfoDescriptor,
    normalizedConfigs,
    basicInfo,
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
