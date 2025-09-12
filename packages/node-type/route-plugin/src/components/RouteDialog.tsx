/**
  * Route Dialog Component (ui-dialog 版)
   */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { RouteWorkingCopy } from '../types';
import { useTranslation } from '../i18n';
import { RouteBasicInfoStep } from './RouteBasicInfoStep';
import { RouteSelectionStep } from './RouteSelectionStep';
import { RouteProcessingStep } from './RouteProcessingStep';
import { notify } from '@hierarchidb/ui-core';
import { useWorkingCopy } from '@hierarchidb/ui-core';
// Avoid build-time hard dependency on ui-dialog; load at runtime
type DialogStep = { id: string; label: string; component: React.ReactNode; validate?: () => Promise<boolean> };
// Align evaluator signature to shared interface: (data, stepNumbers?) => boolean[]
type StepStateEvaluator = { getFilledSteps?: (data: any, stepNumbers?: number[]) => boolean[]; getNavigableSteps?: (data: any, stepNumbers?: number[]) => boolean[] };
let MultiStepDialog: any;

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
  const { workingCopy, setWorkingCopy, init, commit, discard } = useWorkingCopy<RouteWorkingCopy>({ nodeType: 'route', mode, nodeId: nodeId as any, parentId: parentId as any });
  // Initialize working copy from Worker when dialog opens
  useEffect(() => { if (open) { void init(); } }, [open, init]);

  // Simple computed validity based on workingCopy to ease testing and determinism
  const isBasicValid = useMemo(() => {
    return Boolean((workingCopy as any).name?.trim()) && Boolean((workingCopy as any).routeType) &&
      Array.isArray((workingCopy as any).transportModes) && (workingCopy as any).transportModes.length > 0;
  }, [workingCopy]);
  const isSelectionValid = true; // keep permissive; selection completeness is reflected after calculation
  const isProcessingValid = true;

  const steps: DialogStep[] = useMemo(() => [
    {
      id: '1',
      label: t('base-dialog.steps.basicInfo', 'Basic Information'),
      component: (
        <RouteBasicInfoStep
          workingCopy={workingCopy as any}
          onUpdate={(updates) => setWorkingCopy((prev: any) => ({ ...prev, ...updates }))}
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
          workingCopy={workingCopy as any}
          onUpdate={(updates) => setWorkingCopy((prev: any) => ({ ...prev, ...updates }))}
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
          workingCopy={workingCopy as any}
          onUpdate={(updates) => setWorkingCopy((prev: any) => ({ ...prev, ...updates }))}
          onValidationChange={() => {/* computed above */}}
        />
      ),
      validate: async () => isProcessingValid,
    },
  ], [workingCopy, isBasicValid]);

  const evaluator: StepStateEvaluator = useMemo(() => ({
    getFilledSteps: (_data?: any, stepNumbers?: number[]) => {
      const arr = [isBasicValid, isSelectionValid, isProcessingValid];
      if (!stepNumbers || stepNumbers.length === arr.length) return arr;
      // Map by index when stepNumbers provided but lengths differ
      return stepNumbers.map((_, i) => arr[i] ?? false);
    },
    getNavigableSteps: (_data?: any, stepNumbers?: number[]) => {
      const nav = [true, isBasicValid, isSelectionValid];
      if (!stepNumbers || stepNumbers.length === nav.length) return nav;
      return stepNumbers.map((_, i) => nav[i] ?? false);
    },
  }), [isBasicValid]);

  const canSubmit = useCallback(() => isBasicValid && isSelectionValid && isProcessingValid, [isBasicValid]);

  // Display mode: keep volatile here (UI layer is responsible for persistence)
  const [displayMode, setDisplayModeState] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');

  return (
    <MultiStepDialog
      open={open}
      mode={mode}
      title={t('base-dialog.title', 'Route Configuration')}
      icon={null}
      steps={steps}
      currentData={workingCopy}
      evaluateSteps={evaluator}
      evaluateSubmit={canSubmit}
      onSubmit={async () => {
        try {
          await commit();
          if (workingCopy) onSuccess?.(workingCopy);
          notify.success('Route saved successfully');
        } catch (e) {
          onError?.(e as Error);
          notify.error('Failed to save route');
        } finally {
          onClose();
        }
      }}
      onCancel={async () => {
        try { await discard(); notify.info('Route changes discarded'); } catch {}
        onClose();
      }}
      enableA11yTestControls={process.env.NODE_ENV === 'test'}
      displayMode={displayMode}
      onDisplayModeChange={(m: 'standard' | 'maximized' | 'fullscreen') => { setDisplayModeState(m); }}
    />
  );
};
  // Load MultiStepDialog dynamically to avoid static linkage
  React.useEffect(() => {
    (async () => {
      try {
        const M = '@hierarchidb/ui-dialog' as string;
        const mod = await import(/* @vite-ignore */ M);
        MultiStepDialog = (mod as any).MultiStepDialog || (mod as any).default;
      } catch {}
    })();
  }, []);

  // Cleanup draft on unmount (best-effort)
  React.useEffect(() => {
    return () => { void (async () => { try { await discard(); } catch {} })(); };
  }, [discard]);
