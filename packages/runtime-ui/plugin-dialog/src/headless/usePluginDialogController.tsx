import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type HeadlessMultiStepDialogProps,
  type HeadlessContentRenderProps,
  type StepComponentDescriptor,
  type StepNavigationEvent,
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
  DialogData,
  DialogStep,
  DialogDisplayMode,
  MultiDialogSize,
  MultiDialogPosition,
} from '@hierarchidb/ui-dialog';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TagEntity } from '@hierarchidb/common-type';
import { PluginStepRegistry } from '../registry/PluginStepRegistry.js';
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
import { getWorkerClientHook, type WorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import { StepAdapter } from './StepAdapter.js';
import { subscribeDialogStateChannel, type DialogStateEvent } from '@hierarchidb/plugins-base-plugin';

export interface PluginDialogControllerOptions {
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

const toRecord = (value: unknown): Record<string, unknown> | undefined => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
);

const toStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

export function usePluginDialogController(options: PluginDialogControllerOptions): PluginDialogControllerState {
  const {
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

  const workerClientHook: WorkerClientHook<WorkerAPI> = getWorkerClientHook<WorkerAPI>();
  const workerAPI: WorkerAPI | null = workerClientHook();
  const {
    workingCopy,
    hasUnsavedChanges,
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } = useWorkingCopy({ mode, nodeType, nodeId, parentId: pageNodeId, treeId, workerAPI });

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
        if (!workerAPI) return;
        const tagAPI = await workerAPI.getTagAPI();
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
  }, [workerAPI, nodeId, mode]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!workerAPI || !nodeId) return;
        const query = workerAPI.getQueryAPI();
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
  }, [workerAPI, nodeId]);

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
    if (mode=== 'create') return stepRegistry.getCreateSteps(nodeType);
    if (mode === 'edit') return stepRegistry.getEditSteps(nodeType, String(nodeId), workingCopy?.data);
    return [];
  }, [
    mode, stepRegistry, nodeType, nodeId, workingCopy?.data,
  ]);

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
          component: (
            <StepAdapter
              cfg={cfg}
              mode={mode}
              nodeId={String(nodeId)}
              parentId={String(pageNodeId)}
              data={workingCopy?.data}
              updateWorkingCopy={updateWorkingCopy}
            />
          ),
        });
      });
      return result;
    }

    return result.concat(pluginConfigSteps);
  }, [composedConfigs.hasHostBase, composedConfigs.configs, pluginConfigSteps, basicInfo.name, basicInfo.description, basicInfo.tags, tagSuggestions, mode, nodeId, pageNodeId, workingCopy?.data, updateWorkingCopy]);

  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);
  const icon = useMemo(() => getIconComponent(nodeType), [nodeType]);

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    const modeLabel = mode === 'create' ? 'Create' : 'Edit';
    return `${modeLabel} ${label}`;
  }, [presentation?.label, nodeType, mode]);

  const [evaluatedState, setEvaluatedState] = useState<{ enabled?: boolean[]; validated?: boolean[] }>({});
  useEffect(() => {
    let disposed = false;
    const handle = window.setTimeout(async () => {
      const dialogData = (workingCopy?.data ?? {}) as DialogData;
      const validated: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        const v = steps[i]?.validate;
        if (typeof v === 'function') {
          try {
            validated[i] = !!(await Promise.resolve(v(dialogData)));
          } catch {
            validated[i] = false;
          }
        } else {
          validated[i] = true;
        }
      }
      const enabled: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        if (i === 0) { enabled[i] = true; continue; }
        const prevOk = steps.slice(0, i).every((s, idx) => (s?.optional ?? false) ? true : !!validated[idx]);
        enabled[i] = prevOk;
      }
      if (!disposed) setEvaluatedState({ enabled, validated });
    }, 200);
    return () => { disposed = true; window.clearTimeout(handle); };
  }, [steps, basicInfo, workingCopy]);

  const enabledStepIndices = useMemo(() => {
    const nav = evaluatedState.enabled || [];
    return nav.reduce<number[]>((acc, value, idx) => { if (value) acc.push(idx); return acc; }, []);
  }, [evaluatedState.enabled]);

  const validatedStepIndices = useMemo(() => {
    const validated = evaluatedState.validated || [];
    return validated.reduce<number[]>((acc, value, idx) => { if (value) acc.push(idx); return acc; }, []);
  }, [evaluatedState.validated]);

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

  const allStepsComplete = useMemo(() => (evaluatedState.validated || []).every(Boolean), [evaluatedState.validated]);

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
      mode={mode}
      canCommit={allStepsComplete}
      onSaveDraft={handleSaveDraft ? () => { handleSaveDraft().catch(() => void 0); } : undefined}
      disableDraft={!hasUnsavedChanges}
    />
  ), [mode, allStepsComplete, handleSaveDraft, hasUnsavedChanges]);

  const handleCloseRequest = useCallback(() => {
    if (saveDraftInProgress.current) {
      saveDraftInProgress.current = false;
      onClose();
      return;
    }
    handleCancel().catch(() => void 0);
  }, [handleCancel, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const dialogKey = typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : String(nodeId);
    if (!dialogKey) return undefined;

    let disposed = false;

    const unsubscribe = subscribeDialogStateChannel(
      nodeType,
      dialogKey,
      (event: DialogStateEvent) => {
        if (disposed) return;

        if (event.type === 'progress') {
          const nextIndex = typeof event.stepIndex === 'number'
            ? clampIndex(event.stepIndex, steps.length)
            : event.stepId
              ? steps.findIndex((step) => step.id === event.stepId)
              : -1;

          if (nextIndex >= 0 && nextIndex !== activeStepIndex) {
            setActiveStepIndex(nextIndex);
            setUrlStep(nextIndex);
          }
          return;
        }

        if (event.type === 'validation') {
          const targetIndex = typeof event.stepIndex === 'number'
            ? clampIndex(event.stepIndex, steps.length)
            : event.stepId
              ? steps.findIndex((step) => step.id === event.stepId)
              : -1;

          if (targetIndex >= 0) {
            setEvaluatedState((prev) => {
              const previousValidated = Array.from({ length: steps.length }, (_, idx) => prev.validated?.[idx] ?? false);
              previousValidated[targetIndex] = event.isValid;

              const nextEnabled = Array.from({ length: steps.length }, (_, idx) => {
                if (idx === 0) return true;
                return steps
                  .slice(0, idx)
                  .every((step, index) => step.optional || previousValidated[index]);
              });
              nextEnabled[targetIndex] = true;

              return {
                enabled: nextEnabled,
                validated: previousValidated,
              };
            });
          }
          return;
        }

        if (event.type === 'dismiss') {
          handleCloseRequest();
        }
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [
    activeStepIndex,
    handleCloseRequest,
    nodeId,
    nodeType,
    open,
    setEvaluatedState,
    setUrlStep,
    steps,
  ]);

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
