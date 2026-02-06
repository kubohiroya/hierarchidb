import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';
import type {
  composeStepConfigs,
  PluginStepProps as PluginPluginStepProps,
  PluginStepConfig,
  StepData,
} from '@hierarchidb/plugin-base';
import type {
  DialogStep,
  PluginStepProps as HeadlessPluginStepProps,
  StepComponentDescriptor,
  StepValidationFn,
} from '@hierarchidb/ui-dialog';
import { BasicInfoStep } from '@hierarchidb/ui-plugin-basic-info';
import { atom, useAtom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildStepWorkingData,
  isShallowEqualStepData,
  mergeDialogData,
  toRecord,
} from '../controller/step-guards.js';
import type { BasicInfoMeta, DialogUiState, StepCompositionResult } from './data-types.js';

type PluginDefinedEntity = PeerEntity;

type StepContextSnapshot = {
  mode: 'create' | 'edit';
  nodeId: NodeId;
  parentId: NodeId;
  basicInfo: TreeNodeMetadata;
  uiState: DialogUiState;
  draftData: Partial<PluginDefinedEntity>;
  setDraftData: React.Dispatch<React.SetStateAction<Partial<PluginDefinedEntity>>>;
  updateUiState: (next: DialogUiState) => void;
  handleBasicInfoBridge: (data: TreeNodeMetadata) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
};

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
  stepProps: HeadlessPluginStepProps<Partial<PluginDefinedEntity>>;
  stepData: TreeNodeMetadata | Partial<PluginDefinedEntity>;
  draftAtom: PrimitiveAtom<StepData>;
};

const shallowEqualStepData = (a?: StepData, b?: StepData): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (aRecord[key] !== bRecord[key]) return false;
  }
  return true;
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
  draftAtom,
}) => {
  const [slice, setSlice] = useAtom(draftAtom);

  useEffect(() => {
    const next = toRecord(stepData) ?? {};
    setSlice((prev) => (isShallowEqualStepData(prev, next) ? prev : next));
  }, [setSlice, stepData]);

  const handleChange = useCallback(
    (patch: TreeNodeMetadata | Partial<PluginDefinedEntity>) => {
      const current = toRecord(slice) ?? {};
      const nextData: Partial<PluginDefinedEntity> = { ...current, ...(patch as object) };
      onDataChange?.(nextData);
      setSlice(nextData);
      const isBasicInfoStep = cfg.id === 'basic-info';
      if (!isBasicInfoStep) {
        const { name, description, tags, ...rest } = nextData as Record<string, unknown>;
        void name;
        void description;
        void tags;
        setDraftData((prev) => ({
          ...(toRecord(prev) ?? {}),
          ...(rest as Partial<PluginDefinedEntity>),
        }));
      }
    },
    [cfg.id, onDataChange, setDraftData, setSlice, slice]
  );

  const resolvedData = cfg.id === 'basic-info' ? stepData : (slice ?? {});

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: (resolvedData ?? {}) as Partial<PluginDefinedEntity>,
        uiState,
        disabled: false,
        onChange: handleChange,
        onUiStateChange: updateUiState,
        setValid: () => {},
        setError: () => {},
        dialogRef,
      } satisfies PluginPluginStepProps<Partial<PluginDefinedEntity>, DialogUiState>)}
    </>
  );
};

type BasicInfoAdapterProps = {
  value: TreeNodeMetadata;
  tagSuggestions: string[];
  mode: 'create' | 'edit';
  onChange: (data: TreeNodeMetadata) => void;
  validate: () => string | null;
};

const BasicInfoAdapter: React.FC<BasicInfoAdapterProps> = ({
  value,
  tagSuggestions,
  mode,
  onChange,
  validate,
}) => {
  const handleChange = useCallback(
    (data: { name: string; description: string; tags?: string[] }) => {
      onChange({
        name: data.name,
        description: data.description ?? '',
        tags: data.tags ?? [],
      });
    },
    [onChange]
  );
  return (
    <BasicInfoStep
      name={value.name}
      description={value.description ?? ''}
      tags={value.tags ?? []}
      tagSuggestions={tagSuggestions}
      onChange={handleChange}
      mode={mode}
      validate={validate}
    />
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
  basicInfoLabel: string;
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
  basicInfoLabel,
}: Params): StepCompositionResult<PluginDefinedEntity> {
  const [uiState, setUiState] = useState<DialogUiState>({});
  const [draftAtom] = useState<PrimitiveAtom<StepData>>(() =>
    atom(buildStepWorkingData(draftData, basicInfo, basicInfoMeta))
  );
  const [, setDraftAtomValue] = useAtom(draftAtom);
  const workingDataRef = useRef<StepData | undefined>(
    buildStepWorkingData(draftData, basicInfo, basicInfoMeta)
  );
  const basicInfoValidationErrorRef = useRef(basicInfoValidationError);
  basicInfoValidationErrorRef.current = basicInfoValidationError;
  const tagSuggestionsRef = useRef<string[]>(tagSuggestions);
  tagSuggestionsRef.current = tagSuggestions;
  const draftDataRef = useRef<Partial<PluginDefinedEntity>>(draftData);
  draftDataRef.current = draftData;
  const basicInfoValidationPayloadRef = useRef<TreeNodeMetadata>(basicInfo);
  basicInfoValidationPayloadRef.current = basicInfo;
  const modeRef = useRef<'create' | 'edit'>(mode);
  modeRef.current = mode;
  const stepContextRef = useRef<StepContextSnapshot>({
    mode,
    nodeId,
    parentId: pageNodeId,
    basicInfo,
    uiState,
    draftData,
    setDraftData,
    updateUiState: setUiState,
    handleBasicInfoBridge,
    dialogRef,
  });

  stepContextRef.current = {
    mode,
    nodeId,
    parentId: pageNodeId,
    basicInfo,
    uiState,
    draftData,
    setDraftData,
    updateUiState: setUiState,
    handleBasicInfoBridge,
    dialogRef,
  };

  useEffect(() => {
    const nextWorkingData = buildStepWorkingData(draftData, basicInfo, basicInfoMeta);
    if (shallowEqualStepData(workingDataRef.current, nextWorkingData)) {
      return;
    }
    workingDataRef.current = nextWorkingData;
    setDraftAtomValue((prev: StepData | undefined) => ({
      ...(toRecord(prev) ?? {}),
      ...nextWorkingData,
    }));
  }, [draftData, basicInfo, basicInfoMeta, setDraftAtomValue]);
  const normalizedConfigs = useMemo<
    PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>[]
  >(() => {
    return (composedConfigs.configs ?? []).map(
      (cfg: PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>) => ({
        ...cfg,
        validate: cfg.validate
          ? (data?: Partial<PluginDefinedEntity>) =>
              Promise.resolve(cfg.validate?.(data ?? {})).then(Boolean)
          : undefined,
      })
    );
  }, [composedConfigs.configs]);

  const currentStepData = useMemo<Partial<PluginDefinedEntity>>(
    () => buildStepWorkingData(draftData, basicInfo, basicInfoMeta),
    [basicInfo, basicInfoMeta, draftData]
  );
  const dialogDataRef = useRef<Partial<PluginDefinedEntity>>({});
  const dialogData = useMemo<Partial<PluginDefinedEntity>>(() => {
    const merged = mergeDialogData(basicInfo, draftData);
    if (isShallowEqualStepData(dialogDataRef.current, merged)) {
      return dialogDataRef.current;
    }
    dialogDataRef.current = merged;
    return merged;
  }, [basicInfo, draftData]);

  const steps = useMemo<DialogStep[]>(() => {
    const result: DialogStep[] = [];

    if (!composedConfigs.hasHostBase) {
      result.push({
        id: 'basic-info',
        label: basicInfoLabel,
        component: null,
        validate: () => isBasicInfoValid,
      });
    }

    normalizedConfigs.forEach((cfg) => {
      const isBasicInfoStep = cfg.id === 'basic-info';
      const validateFn = cfg.validate;
      const resolveValidate: StepValidationFn | undefined = (() => {
        if (isBasicInfoStep) {
          if (validateFn) {
            return () =>
              Promise.resolve(
                validateFn(
                  basicInfoValidationPayloadRef.current as unknown as Partial<PluginDefinedEntity>
                )
              ).then((valid) => Boolean(valid) && isBasicInfoValid);
          }
          return () => isBasicInfoValid;
        }
        if (!validateFn) return undefined;
        return () => Promise.resolve(validateFn(draftDataRef.current)).then(Boolean);
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
  }, [composedConfigs.hasHostBase, normalizedConfigs, basicInfoLabel, isBasicInfoValid]);

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

  const basicInfoDescriptor = useMemo<StepComponentDescriptor<
    Partial<PluginDefinedEntity>
  > | null>(() => {
    if (composedConfigs.hasHostBase) return null;
    return {
      id: 'basic-info',
      label: basicInfoLabel,
      component: () => (
        <BasicInfoAdapter
          value={basicInfoValidationPayloadRef.current}
          tagSuggestions={tagSuggestionsRef.current}
          mode={modeRef.current}
          validate={() => basicInfoValidationErrorRef.current}
          onChange={handleBasicInfoChange}
        />
      ),
    };
  }, [basicInfoLabel, composedConfigs.hasHostBase, handleBasicInfoChange]);

  const stepConfigRegistryRef = useRef(
    new Map<string, PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>>()
  );
  useEffect(() => {
    const registry = stepConfigRegistryRef.current;
    normalizedConfigs.forEach((cfg) => {
      registry.set(cfg.id, cfg);
    });
  }, [normalizedConfigs]);

  const stepComponentRegistryRef = useRef<
    Map<string, React.FC<HeadlessPluginStepProps<Partial<PluginDefinedEntity>>>>
  >(new Map());

  const getOrCreateStepComponent = useCallback((cfgId: string) => {
    const existing = stepComponentRegistryRef.current.get(cfgId);
    if (existing) return existing;

    const Component: React.FC<HeadlessPluginStepProps<Partial<PluginDefinedEntity>>> = (
      stepProps
    ) => {
      const cfg = stepConfigRegistryRef.current.get(cfgId);
      if (!cfg) return null;
      const ctx = stepContextRef.current;
      return (
        <StepAdapterComponent
          cfg={cfg}
          mode={ctx.mode}
          nodeId={String(ctx.nodeId)}
          parentId={String(ctx.parentId)}
          basicInfo={ctx.basicInfo}
          uiState={ctx.uiState}
          setDraftData={ctx.setDraftData}
          updateUiState={ctx.updateUiState}
          onDataChange={
            cfg.id === 'basic-info'
              ? (data) => ctx.handleBasicInfoBridge(data as TreeNodeMetadata)
              : undefined
          }
          dialogRef={ctx.dialogRef}
          stepProps={stepProps}
          stepData={cfg.id === 'basic-info' ? ctx.basicInfo : ctx.draftData}
          draftAtom={draftAtom}
        />
      );
    };

    stepComponentRegistryRef.current.set(cfgId, Component);
    return Component;
  }, [draftAtom]);

  const stepDescriptors = useMemo<
    ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>>
  >(() => {
    const descriptors: StepComponentDescriptor<Partial<PluginDefinedEntity>>[] = [];

    if (basicInfoDescriptor) {
      descriptors.push(basicInfoDescriptor);
    }

    normalizedConfigs.forEach((cfg) => {
      const component = getOrCreateStepComponent(cfg.id);
      descriptors.push({
        id: cfg.id,
        label: cfg.label ?? cfg.id,
        component,
      });
    });

    return descriptors;
  }, [basicInfoDescriptor, normalizedConfigs, getOrCreateStepComponent]);

  return {
    steps,
    stepDescriptors,
    currentStepData,
    basicInfoValidationPayload: basicInfoValidationPayloadRef.current,
    dialogData,
  };
}
