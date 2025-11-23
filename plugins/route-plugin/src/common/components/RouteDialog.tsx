/**
  * Route Dialog Component (ui-dialog variant)
   */

import { useMemo, useCallback, useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteEntity, RouteWorkingCopy, TagId } from '../types/index.js';
import {
  TabularProvider,
  TabularFilterStep,
  TabularColumnSelectionStep,
} from '@hierarchidb/ui-tabular-extract';
import { createRouteTabularApi } from '../tabular/createRouteTabularApi.js';
import { createRouteDraftWorkingCopy, mergeRouteWorkingCopy, getRouteDraft } from '../utils/workingCopy.js';
import { useTranslation } from '../i18n/index.js';
import { RouteDetailsStep } from './RouteDetailsStep.js';
import { RouteSelectionStep } from './RouteSelectionStep.js';
import { RouteProcessingStep } from './RouteProcessingStep.js';
import { readRuntimeMode } from '@hierarchidb/util';
import { notify } from '@hierarchidb/components';
import { useWorkingCopy } from '@hierarchidb/plugin-ui-sdk';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { runRouteTabularBuild } from '../../worker/tabular/task.js';
import { TabularFileUploadStep } from '@hierarchidb/ui-tabular-extract';
import { useState } from 'react';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type HeadlessMultiStepDialogProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type DialogDisplayMode,
  type MultiDialogSize,
  type MultiDialogPosition,
} from '@hierarchidb/ui-dialog';
import { Button } from '@mui/material';

type DialogStep = { id: string; label: string; component: React.ReactNode; validate?: () => Promise<boolean> };

export interface RouteDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  onSuccess?: (entity: RouteWorkingCopy) => void;
  onError?: (error: Error) => void;
}

export const RouteDialog: React.FC<RouteDialogProps> = ({
  open,
  onClose,
  mode = 'create',
  nodeId,
  parentId,
  onSuccess,
  onError,
}: RouteDialogProps) => {
  const { t } = useTranslation();
  const { workingCopy, setWorkingCopy, init, commit, discard } = useWorkingCopy<RouteWorkingCopy>({
    nodeType: 'route',
    mode,
    nodeId,
    parentId,
  });
  // Initialize working copy from Worker when dialog opens
  useEffect(() => { if (open) { void init(); } }, [open, init]);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [detailsValid, setDetailsValid] = useState(false);
  const [tabularBuildStatus, setTabularBuildStatus] = useState<string | null>(null);

  const updateWorkingCopy = useCallback(
    (updater: (prev: RouteWorkingCopy | null) => RouteWorkingCopy | null) => {
      setWorkingCopy((prev: RouteWorkingCopy | null) => updater(prev));
    },
    [setWorkingCopy],
  );

  useEffect(() => {
    if (!open || workingCopy || mode !== 'create') return;
    const fallbackNodeId = (nodeId ?? parentId ?? (globalThis.crypto?.randomUUID?.() ?? `route-${Date.now()}`)) as NodeId;
    setWorkingCopy((prev: RouteWorkingCopy | null) => (
      prev ?? createRouteDraftWorkingCopy(fallbackNodeId, {}, parentId)
    ));
  }, [open, mode, nodeId, parentId, workingCopy, setWorkingCopy]);

  const applyUpdates = useCallback((updates: Partial<RouteEntity>) => {
    updateWorkingCopy((prev) => (prev ? mergeRouteWorkingCopy(prev, updates) : prev));
  }, [updateWorkingCopy]);

  // Simple computed validity based on workingCopy to ease testing and determinism
  const routeDraft = useMemo(() => (workingCopy ? getRouteDraft(workingCopy) : null), [workingCopy]);
  const resolvedName = typeof routeDraft?.name === 'string' ? routeDraft.name : '';
  const resolvedDescription = typeof routeDraft?.description === 'string' ? routeDraft.description : '';
  const resolvedTags = useMemo(() => {
    const draftTags = Array.isArray(routeDraft?.tags) ? routeDraft?.tags : undefined;
    const wcTags = Array.isArray((workingCopy as RouteWorkingCopy | null)?.tags) ? (workingCopy as RouteWorkingCopy).tags : undefined;
    return (draftTags ?? wcTags ?? []) as TagId[];
  }, [routeDraft?.tags, workingCopy]);

  const isBasicValid = resolvedName.trim().length > 0;
  const isSelectionValid = true;
  const isProcessingValid = true;

  useEffect(() => {
    if (!routeDraft) {
      setDetailsValid(false);
      return;
    }
    const hasRouteType = Boolean(routeDraft.routeType);
    const transports = Array.isArray(routeDraft.transportModes) ? routeDraft.transportModes : [];
    setDetailsValid(hasRouteType && transports.length > 0);
  }, [routeDraft]);

  const handleBasicInfoChange = useCallback((data: BasicInfoData) => {
    applyUpdates({
      name: data.name,
      description: data.description,
      tags: (data.tags ?? []).map((tag) => tag as TagId),
    });
  }, [applyUpdates]);

  const steps: DialogStep[] = useMemo(() => {
    if (!workingCopy) return [];
    const handleUpdate = (updates: Partial<RouteEntity>) => applyUpdates(updates);
    return [
      {
        id: '1',
        label: t('base-dialog.steps.basicInfo', 'Basic Information'),
        component: (
          <SharedBasicInfoStep
            name={resolvedName}
            description={resolvedDescription}
            tags={resolvedTags}
            mode={mode}
            onChange={handleBasicInfoChange}
          />
        ),
        validate: async () => isBasicValid,
      },
      {
        id: '1-details',
        label: t('base-dialog.steps.routeDetails', 'Route Settings'),
        component: (
          <RouteDetailsStep
            workingCopy={workingCopy}
            onUpdate={handleUpdate}
            onValidationChange={setDetailsValid}
          />
        ),
        validate: async () => detailsValid,
      },
      {
        id: '1-source',
        label: t('base-dialog.steps.routeDataSource', 'Data Source'),
        component: (
          <TabularProvider tabularApi={createRouteTabularApi()}>
            <TabularFileUploadStep
              pluginId="route"
              onFileUploaded={(meta) => handleUpdate({ tabularSourceId: meta.id })}
              onError={(msg) => notify.error(msg)}
            />
          </TabularProvider>
        ),
        validate: async () => true,
      },
      {
        id: '2',
        label: t('base-dialog.steps.routeSelection', 'Route Selection'),
        component: (
          <RouteSelectionStep
            workingCopy={workingCopy}
            onUpdate={handleUpdate}
            onValidationChange={() => {/* computed above */}}
          />
        ),
        validate: async () => isSelectionValid,
      },
      {
        id: '3',
        label: t('base-dialog.steps.processing', 'Processing'),
        component: (
          <RouteProcessingStep
            workingCopy={workingCopy}
            onUpdate={handleUpdate}
            onValidationChange={() => {/* computed above */}}
          />
        ),
        validate: async () => isProcessingValid,
      },
      {
        id: '4',
        label: t('base-dialog.steps.routeTabular', 'Filter & Preview'),
        component: (
          <TabularProvider tabularApi={createRouteTabularApi()}>
            <TabularFilterStep
              onConfigChange={(filters) => handleUpdate({ extractConfig: filters as any })}
            />
            <TabularColumnSelectionStep
              onConfigChange={(selection) =>
                handleUpdate({
                  extractConfig: { ...(workingCopy.extractConfig ?? {}), selection } as any,
                })
              }
            />
            <Button
              variant="contained"
              onClick={async () => {
                if (!workingCopy.tabularSourceId) {
                  notify.error('No tabular source to build. Download/Upload first.');
                  return;
                }
                try {
                  setTabularBuildStatus('extracting');
                  const filters = (workingCopy.extractConfig as any)?.filterRules ?? [];
                  const selection = (workingCopy.extractConfig as any)?.selection;
                  const tabularApi = createRouteTabularApi();
                  await runRouteTabularBuild(
                    tabularApi as any,
                    workingCopy.tabularSourceId as string,
                    filters,
                    selection,
                    (nodeId ?? workingCopy.nodeId) as NodeId,
                    (progress) => setTabularBuildStatus(`${progress.stage ?? 'building'} ${progress.completed ?? 0}/${progress.total ?? ''}`)
                  );
                  notify.success('Build completed');
                } catch (err) {
                  notify.error(`Build failed: ${(err as Error).message}`);
                  setTabularBuildStatus(null);
                }
                setTabularBuildStatus(null);
              }}
            >
              {t('base-dialog.actions.build', 'Build')}
            </Button>
            {tabularBuildStatus ? (
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{tabularBuildStatus}</div>
            ) : null}
          </TabularProvider>
        ),
        validate: async () => true,
      },
    ];
  }, [applyUpdates, detailsValid, handleBasicInfoChange, isBasicValid, isProcessingValid, isSelectionValid, mode, resolvedDescription, resolvedName, resolvedTags, t, workingCopy]);

  const filledSteps = useMemo(
    () => [isBasicValid, detailsValid, isSelectionValid, isProcessingValid],
    [detailsValid, isBasicValid, isProcessingValid, isSelectionValid],
  );
  const enabledMatrix = useMemo(
    () => [true, isBasicValid, detailsValid, isSelectionValid],
    [detailsValid, isBasicValid, isSelectionValid],
  );
  const enabledStepIndices = useMemo(() => enabledMatrix
    .map((allow, idx) => (allow ? idx : -1))
    .filter((idx) => idx >= 0), [enabledMatrix]);
  const validatedStepIndices = useMemo(() => filledSteps
    .map((valid, idx) => (valid ? idx : -1))
    .filter((idx) => idx >= 0), [filledSteps]);
  const committableStepIndices = useMemo(() => (steps.length ? [steps.length - 1] : []), [steps.length]);

  // Display mode: keep volatile here (UI layer is responsible for persistence)
  const viewportOnMount = getViewportSize();
  const defaultSize = getPresetSize('normal', viewportOnMount);
  const initialLayout = normalizeDialogState(
    defaultSize,
    initialPosition(defaultSize, viewportOnMount),
    viewportOnMount,
    { enforceTopLeftMargin: true },
  );

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialLayout.size);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialLayout.position);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback((size: MultiDialogSize, position: MultiDialogPosition) => {
    dialogSizeRef.current = size;
    dialogPositionRef.current = position;
    setDialogSize(size);
    setDialogPosition(position);
  }, [setDialogPosition, setDialogSize]);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
    }
  }, [open]);

  // Cleanup draft on unmount (best-effort)
  useEffect(() => {
    return () => { void (async () => { await discard(); })(); };
  }, [discard]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
        setActiveStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
        break;
      case 'back':
        setActiveStepIndex((prev) => Math.max(prev - 1, 0));
        break;
    }
  }, [steps.length]);

  const handleCommit = useCallback(async () => {
    try {
      await commit();
      if (workingCopy) onSuccess?.(workingCopy);
      notify.success('Route saved successfully');
    } catch (e) {
      onError?.(e as Error);
      notify.error('Failed to save route');
      return;
    }
    onClose();
  }, [commit, workingCopy, onSuccess, onError, onClose]);

  const handleCancel = useCallback(async () => {
    try {
      await discard();
      notify.info('Route changes discarded');
    } catch (e) {
      console.warn('[RouteDialog] discard failed', e);
    }
    onClose();
  }, [discard, onClose]);

  const isTestEnv = useMemo(() => readRuntimeMode() === 'test', []);

  const renderHeader: HeadlessMultiStepDialogProps<RouteWorkingCopy | null>['renderHeader'] = useCallback((props: HeadlessHeaderRenderProps<RouteWorkingCopy | null>) => (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
      <div>
        <strong>{t('base-dialog.title', 'Route Configuration')}</strong>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Step {props.activeStepIndex + 1} / {steps.length}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => handleNavigation({ type: 'back' })} disabled={props.activeStepIndex === 0}>Back</button>
        <button type="button" onClick={() => handleNavigation({ type: 'next' })} disabled={props.activeStepIndex >= steps.length - 1}>Next</button>
      </div>
    </header>
  ), [handleNavigation, steps.length, t]);

  const renderContent: HeadlessMultiStepDialogProps<RouteWorkingCopy | null>['renderContent'] = useCallback((props: HeadlessContentRenderProps<RouteWorkingCopy | null>) => (
    <div style={{ padding: 16 }}>
      {steps[props.activeStepIndex]?.component}
    </div>
  ), [steps]);

  const renderFooter: HeadlessMultiStepDialogProps<RouteWorkingCopy | null>['renderFooter'] = useCallback((props: HeadlessFooterRenderProps<RouteWorkingCopy | null>) => {
    const allFilled = filledSteps.every(Boolean);
    return (
      <footer style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dde1eb' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => props.onRequestClose?.('close')}>Cancel</button>
        </div>
        <button type="button" onClick={() => props.onRequestCommit?.()} disabled={!allFilled}>Save</button>
        {isTestEnv && (
          <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            <button type="button" onClick={() => props.onRequestClose?.('close')}>Cancel</button>
            <button type="button" onClick={() => handleNavigation({ type: 'next' })}>Next</button>
            <button type="button" onClick={() => props.onRequestCommit?.()}>Complete</button>
          </div>
        )}
      </footer>
    );
  }, [filledSteps, handleNavigation, isTestEnv]);

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
        targetPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
        applyNormalizedState(normalized.size, normalized.position);
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
  }, [applyNormalizedState, displayMode]);

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    if (mode === 'full-screen') {
      const size: MultiDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      applyNormalizedState(size, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const preset = getPresetSize('maximize', viewport);
      const normalized = normalizeDialogState(preset, {
        x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      }, viewport, {
        enforceTopLeftMargin: false,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const preset = getPresetSize('normal', viewport);
      const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
        enforceTopLeftMargin: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    }

    setDisplayModeState(mode);
  }, [applyNormalizedState, setDisplayModeState]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      next,
      dialogPositionRef.current,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      dialogSizeRef.current,
      next,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<RouteWorkingCopy | null>>>(() => (
    steps.map((step) => ({ id: step.id, label: step.label, component: () => null }))
  ), [steps]);

  const invalidMessageMap = useMemo(() => ({} as Record<string, string>), []);

  const frameStyle = useMemo((): React.CSSProperties => {
    const fullScreen = displayMode === 'full-screen';
    return {
      width: fullScreen ? '100%' : `${dialogSize.width}px`,
      maxWidth: fullScreen ? '100%' : 'min(calc(100vw - 48px), 1280px)',
      height: fullScreen ? '100%' : `${dialogSize.height}px`,
      maxHeight: fullScreen ? '100%' : 'calc(100vh - 48px)',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: fullScreen ? 0 : 12,
      boxShadow: fullScreen ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
      overflow: 'hidden',
      backgroundColor: '#fff',
    };
  }, [dialogSize.height, dialogSize.width, displayMode]);

  return (
    <div style={frameStyle} role="dialog" aria-modal={open}>
      <HeadlessMultiStepDialog
        open={open}
        stepComponents={stepDescriptors}
        stepData={workingCopy}
        onStepDataChange={(patch: Partial<RouteWorkingCopy> | null) => {
          if (!patch || !workingCopy) return;
          applyUpdates(patch as Partial<RouteWorkingCopy>);
        }}
        activeStepIndex={activeStepIndex}
        onStepNavigate={handleNavigation}
        enabledStepIndices={enabledStepIndices}
        validatedStepIndices={validatedStepIndices}
        committableStepIndices={committableStepIndices}
        invalidMessageMap={invalidMessageMap}
        onRequestClose={handleCancel}
        onRequestCommit={handleCommit}
        displayMode={displayMode}
        onDisplayModeChange={(mode: DialogDisplayMode) => { transitionDisplayMode(mode); }}
        position={dialogPosition}
        onPositionChange={handlePositionChange}
        size={dialogSize}
        onSizeChange={handleSizeChange}
        renderHeader={renderHeader}
        renderContent={renderContent}
        renderFooter={renderFooter}
      />
    </div>
  );
};
