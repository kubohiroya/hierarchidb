/**
  * Route Dialog Component (ui-dialog 版)
   */

import React, { useMemo, useState, useCallback } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { RouteWorkingCopy } from '../types';
import { useTranslation } from '../i18n';
import { RouteBasicInfoStep } from './RouteBasicInfoStep';
import { RouteSelectionStep } from './RouteSelectionStep';
import { RouteProcessingStep } from './RouteProcessingStep';
// Avoid build-time hard dependency on ui-dialog; load at runtime
type DialogStep = { id: string; label: string; component: React.ReactNode; validate?: () => Promise<boolean> };
type StepStateEvaluator = { getFilledSteps?: (data: any) => boolean[]; getNavigableSteps?: (data: any) => boolean[] };
let MultiStepDialog: any;

export interface RouteDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
  workingCopy: RouteWorkingCopy;
  onSave: (workingCopy: RouteWorkingCopy) => void;
  onCancel: () => void;
}

export const RouteDialog: React.FC<RouteDialogProps> = ({
  open,
  onClose: _onClose,
  nodeId: _nodeId,
  workingCopy,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
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
          workingCopy={workingCopy}
          onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
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
          onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
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
          onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
          onValidationChange={() => {/* computed above */}}
        />
      ),
      validate: async () => isProcessingValid,
    },
  ], [workingCopy, onSave, isBasicValid]);

  const evaluator: StepStateEvaluator = useMemo(() => ({
    getFilledSteps: () => [isBasicValid, isSelectionValid, isProcessingValid],
    getNavigableSteps: () => [true, isBasicValid, isSelectionValid],
  }), [isBasicValid]);

  const canSubmit = useCallback(() => isBasicValid && isSelectionValid && isProcessingValid, [isBasicValid]);

  // Display mode: keep volatile here (UI layer is responsible for persistence)
  const [displayMode, setDisplayModeState] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');

  return (
    <MultiStepDialog
      open={open}
      mode={'edit'}
      title={t('base-dialog.title', 'Route Configuration')}
      icon={null}
      steps={steps}
      currentData={workingCopy}
      evaluateSteps={evaluator}
      evaluateSubmit={canSubmit}
      onSubmit={async () => onSave(workingCopy)}
      onCancel={onCancel}
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
