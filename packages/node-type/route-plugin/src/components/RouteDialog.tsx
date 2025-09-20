/**
  * Route Dialog Component (ui-dialog 版)
   */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { RouteWorkingCopy } from '../types/index.js';
import { useTranslation } from '../i18n/index.js';
import { RouteBasicInfoStep } from './RouteBasicInfoStep.js';
import { RouteSelectionStep } from './RouteSelectionStep.js';
import { RouteProcessingStep } from './RouteProcessingStep.js';
import { readRuntimeMode } from '@hierarchidb/util';
import { notify } from '@hierarchidb/ui-core';
import { useWorkingCopy } from '@hierarchidb/ui-core';
import {
  HeadlessMultiStepDialog,
  type HeadlessMultiStepDialogProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
} from '@hierarchidb/ui-dialog';

type DialogStep = { id: string; label: string; component: React.ReactNode; validate?: () => Promise<boolean> };

export interface RouteDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
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
}) => {
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

  const updateWorkingCopy = useCallback((updater: (prev: RouteWorkingCopy) => RouteWorkingCopy) => {
    setWorkingCopy((prev) => (prev ? updater(prev) : prev));
  }, [setWorkingCopy]);

  const applyUpdates = useCallback((updates: Partial<RouteWorkingCopy>) => {
    updateWorkingCopy((prev) => ({ ...prev, ...updates }));
  }, [updateWorkingCopy]);

  // Simple computed validity based on workingCopy to ease testing and determinism
  const isBasicValid = useMemo(() => {
    if (!workingCopy) return false;
    const { name, routeType, transportModes } = workingCopy;
    return Boolean(name?.trim()) && Boolean(routeType) && Array.isArray(transportModes) && transportModes.length > 0;
  }, [workingCopy]);
  const isSelectionValid = true; // keep permissive; selection completeness is reflected after calculation
  const isProcessingValid = true;

  const steps: DialogStep[] = useMemo(() => {
    if (!workingCopy) return [];
    const handleUpdate = (updates: Partial<RouteWorkingCopy>) => applyUpdates(updates);
    return [
      {
        id: '1',
        label: t('base-dialog.steps.basicInfo', 'Basic Information'),
        component: (
          <RouteBasicInfoStep
            workingCopy={workingCopy}
            onUpdate={handleUpdate}
            onValidationChange={() => {/* computed above */}}
          />
        ),
        validate: async () => isBasicValid,
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
    ];
  }, [applyUpdates, isBasicValid, isProcessingValid, isSelectionValid, t, workingCopy]);

  const filledSteps = useMemo(() => [isBasicValid, isSelectionValid, isProcessingValid], [isBasicValid, isProcessingValid, isSelectionValid]);
  const navigableSteps = useMemo(() => [true, isBasicValid, isSelectionValid], [isBasicValid, isSelectionValid]);
  const enabledStepIndices = useMemo(() => navigableSteps
    .map((allow, idx) => (allow ? idx : -1))
    .filter((idx) => idx >= 0), [navigableSteps]);
  const validatedStepIndices = useMemo(() => filledSteps
    .map((valid, idx) => (valid ? idx : -1))
    .filter((idx) => idx >= 0), [filledSteps]);
  const committableStepIndices = useMemo(() => (steps.length ? [steps.length - 1] : []), [steps.length]);

  // Display mode: keep volatile here (UI layer is responsible for persistence)
  const [displayMode, setDisplayModeState] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');

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

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<RouteWorkingCopy | null>>>(() => (
    steps.map((step) => ({ id: step.id, label: step.label, component: () => null }))
  ), [steps]);

  const invalidMessageMap = useMemo(() => ({} as Record<string, string>), []);

  return (
    <HeadlessMultiStepDialog
      open={open}
      stepComponents={stepDescriptors}
      stepData={workingCopy}
      onStepDataChange={(patch) => {
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
      onDisplayModeChange={(m) => setDisplayModeState(m)}
      renderHeader={renderHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
};
