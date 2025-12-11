import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { BasicInfoStep } from '@hierarchidb/ui-plugin-basic-info';
import type {
  PluginStepConfig,
  composeStepConfigs,
  StepData,
  StepComponentProps as PluginStepComponentProps,
} from '@hierarchidb/plugin-base';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type {
  DialogStep,
  StepComponentDescriptor,
  StepValidationFn,
  StepComponentProps as HeadlessStepComponentProps,
} from '@hierarchidb/ui-dialog';
import { buildStepWorkingData, mergeDialogData, toRecord, isShallowEqualStepData } from '../controller/step-guards.js';
import type {
  StepCompositionResult,
  BasicInfoMeta,
  DialogUiState,
} from './data-types.js';

type PluginDefinedEntity = Record<string, unknown>;

type StepContextSnapshot = {
  mode: 'create' | 'edit';
  nodeId: NodeId;
  parentId: NodeId;
  basicInfo: TreeNodeMetadata;
  uiState: DialogUiState;
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
  stepProps: HeadlessStepComponentProps<Partial<PluginDefinedEntity>>;
  stepData: TreeNodeMetadata | Partial<PluginDefinedEntity>
};

const shallowEqualStepData = (
  a?: StepData,
  b?: StepData
): boolean => {
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
}) => {
  const draftAtom = useRef(atom<StepData>(stepData ?? {}));
  const [, setSlice] = useAtom(draftAtom.current);
  const prevStepDataRef = useRef<StepData>(toRecord(stepData) ?? {});

  useEffect(() => {
    const next = toRecord(stepData) ?? {};
    if (isShallowEqualStepData(prevStepDataRef.current, next)) {
      return;
    }
    prevStepDataRef.current = next;
    setSlice(next);
  }, [setSlice, stepData]);

  const handleChange = useCallback(
    (patch: TreeNodeMetadata | Partial<PluginDefinedEntity>) => {
      const current = toRecord(stepData) ?? {};
      const nextData: Partial<PluginDefinedEntity> = { ...current, ...(patch as object) };
      onDataChange?.(nextData);
      setSlice(nextData);
      const isBasicInfoStep = cfg.id === 'basic-info';
      if (!isBasicInfoStep) {
        const { name, description, tags, ...rest } = nextData as Record<string, unknown>;
        void name;
        void description;
        void tags;
        setDraftData(rest as Partial<PluginDefinedEntity>);
      }
    },
    [cfg.id, onDataChange, stepData, setDraftData, setSlice]
  );

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: (stepData ?? {}) as Partial<PluginDefinedEntity>,
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
  const workingDataRef = useRef<StepData | undefined>(buildStepWorkingData(draftData, basicInfo, basicInfoMeta));
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
    setDraftAtomValue((prev) => ({
      ...(toRecord(prev) ?? {}),
      ...nextWorkingData,
    }));
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
        label: 'Basic Information',
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
                Boolean(
                  validateFn(basicInfoValidationPayloadRef.current as unknown as Partial<PluginDefinedEntity>)
                ) && isBasicInfoValid;
          }
          return () => isBasicInfoValid;
        }
        if (!validateFn) return undefined;
        return () => Boolean(validateFn(draftDataRef.current));
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
  }, [composedConfigs.hasHostBase, normalizedConfigs, isBasicInfoValid]);

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
          const prev = (get(draftAtom) as Record<string, unknown>) ?? {};
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
          const prev = (get(draftAtom) as Record<string, unknown>) ?? {};
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
          const prev = (get(draftAtom) as Record<string, unknown>) ?? {};
          set(draftAtom, { ...prev, tags: val });
        }
      ),
    [draftAtom]
  );

  const basicInfoComponentRef =
    useRef<React.FC<HeadlessStepComponentProps<Partial<PluginDefinedEntity>>> | null>(null);

  if (!basicInfoComponentRef.current) {
    basicInfoComponentRef.current = React.memo((props) => {
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
        [props, setDescription, setName, setTags]
      );

      return (
        <BasicInfoStep
          name={name}
          description={description}
          tags={tags}
          tagSuggestions={tagSuggestionsRef.current}
          onChange={handleChange}
          mode={modeRef.current}
          validate={() => basicInfoValidationErrorRef.current}
        />
      );
    });
  }

  const basicInfoDescriptor = useMemo<StepComponentDescriptor<Partial<PluginDefinedEntity>> | null>(() => {
    if (composedConfigs.hasHostBase) return null;
    return {
      id: 'basic-info',
      label: 'Basic Information',
      component: basicInfoComponentRef.current as React.FC<
        HeadlessStepComponentProps<Partial<PluginDefinedEntity>>
      >,
    };
  }, [composedConfigs.hasHostBase]);

  const stepConfigRegistryRef = useRef(new Map<string, PluginStepConfig<Partial<PluginDefinedEntity>, DialogUiState>>());
  useEffect(() => {
    const registry = stepConfigRegistryRef.current;
    normalizedConfigs.forEach((cfg) => {
      registry.set(cfg.id, cfg);
    });
  }, [normalizedConfigs]);

  const stepComponentRegistryRef = useRef<
    Map<string, React.FC<HeadlessStepComponentProps<Partial<PluginDefinedEntity>>>>
  >(new Map());

  const getOrCreateStepComponent = useCallback(
    (cfgId: string) => {
      const existing = stepComponentRegistryRef.current.get(cfgId);
      if (existing) return existing;

      const Component: React.FC<HeadlessStepComponentProps<Partial<PluginDefinedEntity>>> = (stepProps) => {
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
            stepData={cfg.id === 'basic-info' ? ctx.basicInfo : stepProps.data ?? {}}
          />
        );
      };

      stepComponentRegistryRef.current.set(cfgId, Component);
      return Component;
    },
    []
  );

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
  }, [
    basicInfoDescriptor,
    normalizedConfigs,
    getOrCreateStepComponent,
  ]);

  return {
    steps,
    stepDescriptors,
    currentStepData,
    basicInfoValidationPayload: basicInfoValidationPayloadRef.current,
    dialogData,
  };
}
