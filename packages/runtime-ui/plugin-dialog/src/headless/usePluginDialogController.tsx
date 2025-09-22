import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeadlessMultiStepDialogProps,
  HeadlessContentRenderProps,
  StepComponentDescriptor,
  StepNavigationEvent,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
} from '@hierarchidb/ui-dialog';
import { Box } from '@mui/material';
import type {
  DialogStep,
  DialogDisplayMode,
  MultiDialogSize,
  MultiDialogPosition,
} from '@hierarchidb/ui-dialog';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TagEntity } from '@hierarchidb/common-type';
import { PluginStepRegistry, type PluginStepConfig } from '../registry/PluginStepRegistry.js';
import { HostProfileRegistry } from '../registry/HostProfileRegistry.js';
import { composeStepConfigs } from '../services/StepComposer.js';
import { useWorkingCopy } from '../hooks/useWorkingCopy.js';
import { getIconComponent, getPresentation } from '../utils/pluginPresentation.js';
import { PluginDialogHeader, PluginDialogFooter } from './components/index.js';
import {
  getPeerDisplayMode,
  setPeerDisplayMode,
  getPeerDialogPosition,
  setPeerDialogPosition,
  getPeerDialogSize,
  setPeerDialogSize,
  type PeerDisplayMode,
} from '../utils/peerDialogPersistence.js';
import { useDialogUrlSync } from '../hooks/useDialogUrlSync.js';
import { BasicInfoStep } from '../components/steps/BasicInfoStep.js';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';

export interface PluginDialogControllerOptions {
  intent: 'create' | 'edit';
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  treeId: TreeId;
  open: boolean;
  initialStep?: number;
  onClose: () => void;
  onSuccess?: (nodeId: NodeId) => void;
}

export interface PluginDialogControllerState {
  headlessProps: HeadlessMultiStepDialogProps<any>;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<any>>;
  loading: boolean;
  error: unknown;
  icon?: React.ReactNode;
  presentation?: {
    label: string;
    description?: string;
  };
  hasUnsavedChanges: boolean;
}

const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
const DEFAULT_POSITION: MultiDialogPosition = initialPosition(DEFAULT_SIZE, DEFAULT_VIEWPORT);

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

const isWorkerAPI = (value: unknown): value is WorkerAPI => (
  typeof value === 'object'
  && value !== null
  && 'getQueryAPI' in value
  && typeof (value as { getQueryAPI: unknown }).getQueryAPI === 'function'
);

const isWorkerHolder = (value: unknown): value is { client?: WorkerAPI | null } => (
  typeof value === 'object'
  && value !== null
  && 'client' in value
);

const toRecord = (value: unknown): Record<string, unknown> | undefined => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
);

const toStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

export function usePluginDialogController(options: PluginDialogControllerOptions): PluginDialogControllerState {
  const {
    intent,
    mode,
    nodeType,
    nodeId,
    treeId,
    pageNodeId,
    open,
    initialStep = 0,
    onClose,
    onSuccess,
  } = options;

  const navigate = useNavigate();
  const stepRegistry = PluginStepRegistry.getInstance();
  const hostRegistry = HostProfileRegistry.getInstance();

  type WorkerRef = WorkerAPI | { client?: WorkerAPI | null } | null;
  const useClientHook = getWorkerClientHook<WorkerRef>() ?? (() => null);
  const ref = useClientHook();
  const client: WorkerAPI | null = useMemo(() => {
    if (isWorkerAPI(ref)) return ref;
    if (isWorkerHolder(ref) && ref.client && isWorkerAPI(ref.client)) return ref.client;
    return null;
  }, [ref]);

  const {
    workingCopy,
    hasUnsavedChanges,
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } = useWorkingCopy({ mode, nodeType, nodeId, parentId: pageNodeId, treeId, client });

  const { step: urlStep, setStep: setUrlStep, mode: urlMode, setMode: setUrlMode } = useDialogUrlSync({
    defaults: { step: initialStep, mode: 'normal' },
    debounce: { map: 0 },
    history: { step: 'replace' },
  });

  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(urlStep, Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(DEFAULT_POSITION);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const positionPersistTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dm, pos, sz] = await Promise.all([
          getPeerDisplayMode(nodeType, String(nodeId)),
          getPeerDialogPosition(nodeType, String(nodeId)),
          getPeerDialogSize(nodeType, String(nodeId)),
        ]);
        if (!mounted) return;
        if (dm) {
          setDisplayModeState(dm as DialogDisplayMode);
          setUrlMode(dm === 'full-screen' ? 'full' : 'normal');
        }
        if (pos) {
          setDialogPosition(pos);
          dialogPositionRef.current = pos;
        }
        if (sz) {
          setDialogSize(sz);
          dialogSizeRef.current = sz;
        }
      } catch (err) {
        console.warn('[PluginDialogShell] restore frame state failed', err);
      }
    })();
    return () => { mounted = false; };
  }, [nodeType, nodeId, setUrlMode]);

  const persistDisplayMode = useCallback((value: DialogDisplayMode) => {
    setDisplayModeState(value);
    setPeerDisplayMode(nodeType, String(nodeId), value as PeerDisplayMode).catch(() => void 0);
    setUrlMode(value === 'full-screen' ? 'full' : 'normal');
  }, [nodeType, nodeId, setUrlMode]);

  useEffect(() => () => {
    if (positionPersistTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(positionPersistTimeoutRef.current);
      positionPersistTimeoutRef.current = null;
    }
  }, []);

  const persistPosition = useCallback((next: MultiDialogPosition) => {
    setDialogPosition(next);
    dialogPositionRef.current = next;

    if (typeof window !== 'undefined') {
      if (positionPersistTimeoutRef.current !== null) {
        window.clearTimeout(positionPersistTimeoutRef.current);
      }
      positionPersistTimeoutRef.current = window.setTimeout(() => {
        positionPersistTimeoutRef.current = null;
        setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
      }, 16); // ~1 frame debounce
    } else {
      setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
    }
  }, [nodeType, nodeId]);

  const persistSize = useCallback((next: MultiDialogSize) => {
    setDialogSize(next);
    dialogSizeRef.current = next;
    setPeerDialogSize(nodeType, String(nodeId), next).catch(() => void 0);
  }, [nodeType, nodeId]);

  const transitionDisplayMode = useCallback(async (mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    const applyNormalizedState = (size: MultiDialogSize, position: MultiDialogPosition) => {
      dialogSizeRef.current = size;
      dialogPositionRef.current = position;
      persistSize(size);
      persistPosition(position);
    };

    if (mode === 'full-screen') {
      const fullSize: MultiDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      applyNormalizedState(fullSize, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const size = getPresetSize('maximize', viewport);
      const position: MultiDialogPosition = {
        x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      };
      const normalized = normalizeDialogState(size, position, viewport, {
        enforceTopLeftMargin: false,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const size = getPresetSize('normal', viewport);
      const position = initialPosition(size, viewport);
      const normalized = normalizeDialogState(size, position, viewport, { enforceTopLeftMargin: true });
      applyNormalizedState(normalized.size, normalized.position);
    }

    setDisplayModeState(mode);
    persistDisplayMode(mode);
  }, [persistDisplayMode, persistPosition, persistSize]);

  useEffect(() => {
    const modeKey = urlMode as string;
    if (modeKey === 'full') {
      void transitionDisplayMode('full-screen');
    } else if (displayMode === 'full-screen' && modeKey !== 'full') {
      void transitionDisplayMode('normal');
    }
  }, [urlMode, displayMode, transitionDisplayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = { x: FRAME_CONSTANTS.NON_STANDARD_MARGIN, y: FRAME_CONSTANTS.NON_STANDARD_MARGIN };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        dialogSizeRef.current = normalized.size;
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        dialogPositionRef.current = normalized.position;
        persistPosition(normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [displayMode, persistPosition, persistSize]);

  const [basicInfo, setBasicInfo] = useState({ name: '', description: '', tags: [] as string[] });
  useEffect(() => {
    if (workingCopy) {
      const tagsValue = workingCopy.data?.['tags'];
      const tags = toStringArray(tagsValue);
      setBasicInfo({ name: workingCopy.name ?? '', description: workingCopy.description ?? '', tags });
    }
  }, [workingCopy]);

  const [tagSuggestions, setTagSuggestions] = useState<string[]>(() => []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client) return;
        const tagAPI = await client.getTagAPI();
        const all = await tagAPI.getAllTags();
        if (!disposed) setTagSuggestions(all.map((t: TagEntity) => t.name).filter((name): name is string => typeof name === 'string'));
        if (mode === 'edit' && nodeId) {
          const nodeTags = await tagAPI.getTagsForNode(nodeId);
          const names = (nodeTags || []).map((t: TagEntity) => t.name).filter((name): name is string => typeof name === 'string');
          if (!disposed && names.length) setBasicInfo(prev => ({ ...prev, tags: prev.tags.length ? prev.tags : names }));
        }
      } catch (err) {
        console.warn('[PluginDialogShell] load tag suggestions failed', err);
      }
    })();
    return () => { disposed = true; };
  }, [client, nodeId, mode]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client || !nodeId) return;
        const query = await client.getQueryAPI();
        const node = await query.getNode(nodeId);
        if (!node || disposed) return;
        const nodeData = toRecord((node as unknown as { data?: unknown }).data);
        const nodeTags = toStringArray(nodeData?.['tags']);
        setBasicInfo(prev => ({
          name: prev.name || node.name || '',
          description: prev.description || node.description || '',
          tags: prev.tags.length ? prev.tags : nodeTags,
        }));
      } catch (err) {
        console.warn('[PluginDialogShell] prefill from QueryAPI failed', err);
      }
    })();
    return () => { disposed = true; };
  }, [client, nodeId]);

  const [regTick, setRegTick] = useState(0);
  const [hostTick, setHostTick] = useState(0);
  useEffect(() => {
    const unsubA = stepRegistry.subscribe?.(() => setRegTick(v => v + 1));
    const unsubB = hostRegistry?.subscribe?.(() => setHostTick(v => v + 1));
    return () => { unsubA?.(); unsubB?.(); };
  }, [stepRegistry, hostRegistry]);

  const composedConfigs = useMemo(() => {
    void regTick; void hostTick;
    return composeStepConfigs(nodeType, mode);
  }, [nodeType, mode, regTick, hostTick]);

  const pluginConfigSteps = useMemo(() => {
    void regTick;
    if (mode === 'create') return stepRegistry.getCreateSteps(nodeType);
    if (mode === 'edit') return stepRegistry.getEditSteps(nodeType, String(nodeId), workingCopy?.data);
    return [];
  }, [mode, nodeType, nodeId, workingCopy?.data, stepRegistry, regTick]);

  const StepAdapter: React.FC<{ cfg: PluginStepConfig }> = useCallback(({ cfg }) => {
    const [, setValid] = useState<boolean | undefined>();
    const [, setError] = useState<string | null>(null);

    useEffect(() => {
      if (typeof cfg.validate === 'function') {
        Promise.resolve(cfg.validate()).then(res => setValid(!!res)).catch(() => setValid(false));
      }
    }, [cfg]);

    return (
      <>
        {cfg.componentFactory({
          mode,
          nodeId: String(nodeId),
          parentId: String(pageNodeId),
          data: workingCopy?.data,
          onChange: (data: unknown) => updateWorkingCopy({ data: data as Record<string, unknown> }),
          setValid,
          setError,
        })}
      </>
    );
  }, [mode, nodeId, pageNodeId, updateWorkingCopy, workingCopy?.data]);

  const steps: DialogStep[] = useMemo(() => {
    const result: DialogStep[] = [];

    if (!composedConfigs.hasHostBase) {
      result.push({
        id: 'basic-info',
        label: 'Basic Information',
        component: (
          <BasicInfoStep
            name={basicInfo.name}
            description={basicInfo.description}
            tags={basicInfo.tags}
            tagSuggestions={tagSuggestions}
            onChange={(data) => setBasicInfo({ name: data.name, description: data.description ?? '', tags: data.tags ?? [] })}
            mode={mode}
          />
        ),
        validate: () => basicInfo.name.trim().length > 0,
      });
    }

    if (composedConfigs.configs.length) {
      composedConfigs.configs.forEach(cfg => {
        const validateFn = cfg.validate;
        result.push({
          id: cfg.id,
          label: cfg.label ?? cfg.id,
          optional: !!cfg.optional,
          validate: validateFn ? () => validateFn(workingCopy?.data) : undefined,
          component: <StepAdapter cfg={cfg} />,
        });
      });
      return result;
    }

    return result.concat(pluginConfigSteps);
  }, [composedConfigs, basicInfo, tagSuggestions, mode, StepAdapter, pluginConfigSteps, workingCopy?.data]);

  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);
  const icon = useMemo(() => getIconComponent(nodeType), [nodeType]);

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    const modeLabel = intent === 'create' ? 'Create' : 'Edit';
    return `${modeLabel} ${label}`;
  }, [presentation?.label, nodeType, intent]);

  const [evaluatedState, setEvaluatedState] = useState<{ navigable?: boolean[]; filled?: boolean[] }>({});
  useEffect(() => {
    let disposed = false;
    const handle = window.setTimeout(async () => {
      const filled: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        const v = steps[i]?.validate;
        if (typeof v === 'function') {
          try { filled[i] = !!(await Promise.resolve(v())); } catch { filled[i] = false; }
        } else {
          filled[i] = true;
        }
      }
      const navigable: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        if (i === 0) { navigable[i] = true; continue; }
        const prevOk = steps.slice(0, i).every((s, idx) => (s?.optional ?? false) ? true : !!filled[idx]);
        navigable[i] = prevOk;
      }
      if (!disposed) setEvaluatedState({ navigable, filled });
    }, 200);
    return () => { disposed = true; window.clearTimeout(handle); };
  }, [steps, basicInfo, workingCopy]);

  const enabledStepIndices = useMemo(() => {
    const nav = evaluatedState.navigable || [];
    return nav.reduce<number[]>((acc, value, idx) => { if (value) acc.push(idx); return acc; }, []);
  }, [evaluatedState.navigable]);

  const validatedStepIndices = useMemo(() => {
    const filled = evaluatedState.filled || [];
    return filled.reduce<number[]>((acc, value, idx) => { if (value) acc.push(idx); return acc; }, []);
  }, [evaluatedState.filled]);

  const committableStepIndices = useMemo(() => (
    steps.length ? [steps.length - 1] : []
  ), [steps.length]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    let nextIndex = activeStepIndex;
    switch (event.type) {
      case 'direct':
        nextIndex = clampIndex(event.targetIndex, steps.length);
        break;
      case 'next':
        nextIndex = clampIndex(activeStepIndex + 1, steps.length);
        break;
      case 'back':
        nextIndex = clampIndex(activeStepIndex - 1, steps.length);
        break;
    }
    if (nextIndex === activeStepIndex) return;
    setActiveStepIndex(nextIndex);
    setUrlStep(nextIndex);
  }, [activeStepIndex, steps.length, setUrlStep]);

  const navigateToNode = useCallback((targetId: NodeId) => {
    navigate(`/t/${treeId}/${pageNodeId}/${targetId}`);
  }, [navigate, treeId, pageNodeId]);

  const saveDraftInProgress = useRef(false);

  const handleSubmit = useCallback(async () => {
    console.debug("[Folder-create]");
    const finalData = {
      ...workingCopy,
      name: basicInfo.name,
      description: basicInfo.description,
      data: { ...(workingCopy?.data as Record<string, unknown> || {}), tags: basicInfo.tags },
    };

    const savedNodeId = await saveWorkingCopy(finalData);

    try {
      await discardWorkingCopy();
    } catch (err) {
      console.warn('[PluginDialogShell] discard after submit failed', err);
    }

    if (savedNodeId) {
      onSuccess?.(savedNodeId);
      navigateToNode(savedNodeId);
    }

    onClose();
  }, [workingCopy, basicInfo, saveWorkingCopy, discardWorkingCopy, onSuccess, navigateToNode, onClose]);

  const handleSaveDraft = useCallback(async () => {
    try {
      saveDraftInProgress.current = true;
      const draftData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
        isDraft: true,
      };
      await saveDraft(draftData);
    } catch (err) {
      saveDraftInProgress.current = false;
      throw err;
    }
  }, [workingCopy, basicInfo, saveDraft]);

  const handleCancel = useCallback(async () => {
    try {
      await discardWorkingCopy();
    } catch (err) {
      console.warn('[PluginDialogShell] discard on cancel failed', err);
    }
    onClose();
  }, [discardWorkingCopy, onClose]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<any>>>(() => (
    steps.map(step => ({ id: step.id, label: step.label ?? step.id, component: () => null }))
  ), [steps]);

  const allStepsComplete = useMemo(() => (evaluatedState.filled || []).every(Boolean), [evaluatedState.filled]);

  const headerSubtitle = useMemo(() => {
    if (mode === 'edit') {
      const desc = presentation?.description?.trim();
      if (desc) {
        return desc;
      }
    }
    return undefined;
  }, [mode, presentation?.description]);

  const HeaderComponent: HeadlessMultiStepDialogProps<any>['HeaderComponent'] = useCallback(() => (
    <PluginDialogHeader
      title={dialogTitle}
      subtitle={headerSubtitle}
      icon={icon || undefined}
    />
  ), [dialogTitle, headerSubtitle, icon]);

  const renderContent = useCallback((propsContent: HeadlessContentRenderProps<any>) => {
    const step = steps[propsContent.activeStepIndex];
    return (
      <Box
        sx={(theme) => ({
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing(2),
          backgroundColor: theme.palette.background.default,
        })}
      >
        {step?.component ?? null}
      </Box>
    );
  }, [steps]);

  const FooterComponent: HeadlessMultiStepDialogProps<any>['FooterComponent'] = useCallback(() => (
    <PluginDialogFooter
      intent={intent}
      canCommit={allStepsComplete}
      onSaveDraft={handleSaveDraft ? () => { handleSaveDraft().catch(() => void 0); } : undefined}
      disableDraft={!hasUnsavedChanges}
    />
  ), [intent, allStepsComplete, handleSaveDraft, hasUnsavedChanges]);

  const handleCloseRequest = useCallback(() => {
    if (saveDraftInProgress.current) {
      saveDraftInProgress.current = false;
      onClose();
      return;
    }
    handleCancel().catch(() => void 0);
  }, [handleCancel, onClose]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const viewport = getViewportSize();
    const normalized = normalizeDialogState(
      next,
      dialogPositionRef.current,
      viewport,
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
      persistSize(normalized.size);
    }
    if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
      persistPosition(normalized.position);
    }
  }, [displayMode, persistPosition, persistSize]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const viewport = getViewportSize();
    const normalized = normalizeDialogState(
      dialogSizeRef.current,
      next,
      viewport,
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
      persistSize(normalized.size);
    }
    if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
      persistPosition(normalized.position);
    }
  }, [displayMode, persistPosition, persistSize]);

  const headlessProps: HeadlessMultiStepDialogProps<any> = {
    open,
    stepComponents: stepDescriptors,
    stepData: workingCopy?.data ?? {},
    onStepDataChange: (patch: Record<string, unknown>) => updateWorkingCopy({ data: { ...(workingCopy?.data as Record<string, unknown> || {}), ...patch } }),
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap: {},
    onRequestClose: handleCloseRequest,
    onRequestCommit: () => { console.debug("[Folder-create]"); handleSubmit().catch(() => void 0); },
    isDirty: hasUnsavedChanges,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (mode) => { void transitionDisplayMode(mode); },
    HeaderComponent,
    renderContent,
    FooterComponent,
  };

  return {
    headlessProps,
    stepDescriptors,
    loading,
    error,
    icon: icon ?? undefined,
    presentation,
    hasUnsavedChanges,
  };
}
