import { useMemo, useState, useCallback } from 'react';
import {
  HeadlessMultiStepDialog,
  type HeadlessMultiStepDialogProps,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type StepComponentDescriptor,
  type StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoValues } from './steps/BasicInfoStep.js';
import { FramesPreviewStep, type TimelineFrame } from './steps/FramesPreviewStep.js';
import { MapPreviewStep } from './steps/MapPreviewStep.js';
import { AnimationViewerStep } from './steps/AnimationViewerStep.js';

export interface TimelineDialogProps {
  mode: 'create' | 'edit';
  parentId?: string;
  nodeId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (savedNodeId: string) => void;
}

type TimelineDialogStep = {
  id: string;
  label: string;
  component: React.ReactNode;
  validate?: () => Promise<boolean>;
};

export function TimelineDialog(props: TimelineDialogProps) {
  const [basic, setBasic] = useState<BasicInfoValues>({ name: 'New Timeline', description: '' });
  const [frames] = useState<TimelineFrame[]>([
    { id: 'f1', name: 'Frame A' },
    { id: 'f2', name: 'Frame B' },
    { id: 'f3', name: 'Frame C' },
  ]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const steps = useMemo<TimelineDialogStep[]>(() => [
    {
      id: 'basic',
      label: 'Basic Information',
      component: <BasicInfoStep values={basic} onChange={setBasic} />,
      validate: async () => (basic?.name || '').trim().length > 0,
    },
    { id: 'frames', label: 'Frames Preview', component: <FramesPreviewStep frames={frames} /> },
    { id: 'map', label: 'Map Preview', component: <MapPreviewStep frames={frames} /> },
    { id: 'final', label: 'Final Animation', component: <AnimationViewerStep frames={frames} /> },
  ], [basic, frames]);

  const filledSteps = useMemo(() => [
    (basic?.name || '').trim().length > 0,
    true,
    true,
    true,
  ], [basic]);

  const enabledStepIndices = useMemo(() => filledSteps
    .map((_, idx) => (idx === 0 || filledSteps.slice(0, idx).every(Boolean) ? idx : -1))
    .filter(idx => idx >= 0), [filledSteps]);

  const validatedStepIndices = useMemo(() => filledSteps
    .map((valid, idx) => (valid ? idx : -1))
    .filter(idx => idx >= 0), [filledSteps]);

  const committableStepIndices = useMemo(() => (steps.length ? [steps.length - 1] : []), [steps.length]);

  const dialogTitle = useMemo(() => (props.mode === 'create' ? 'Create Timeline' : 'Edit Timeline'), [props.mode]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
        setActiveStepIndex(prev => Math.min(prev + 1, steps.length - 1));
        break;
      case 'back':
        setActiveStepIndex(prev => Math.max(prev - 1, 0));
        break;
    }
  }, [steps.length]);

  const handleCommit = useCallback(() => {
    props.onSuccess(props.nodeId || 'timeline-new');
  }, [props]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<any>>>(() => (
    steps.map(step => ({ id: step.id, label: step.label, component: () => null }))
  ), [steps]);

  const renderHeader = useCallback((propsHeader: HeadlessHeaderRenderProps<any>) => (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
      <div>
        <strong>{dialogTitle}</strong>
        <div style={{ fontSize: 12, color: '#64748b' }}>Step {propsHeader.activeStepIndex + 1} / {steps.length}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => handleNavigation({ type: 'back' })} disabled={propsHeader.activeStepIndex === 0}>Back</button>
        <button type="button" onClick={() => handleNavigation({ type: 'next' })} disabled={propsHeader.activeStepIndex >= steps.length - 1}>Next</button>
      </div>
    </header>
  ), [dialogTitle, handleNavigation, steps.length]);

  const renderContent = useCallback((propsContent: HeadlessContentRenderProps<any>) => (
    <div style={{ padding: 16 }}>
      {steps[propsContent.activeStepIndex]?.component}
    </div>
  ), [steps]);

  const renderFooter = useCallback((propsFooter: HeadlessFooterRenderProps<any>) => {
    const allValid = filledSteps.every(Boolean);
    return (
      <footer style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dde1eb' }}>
        <button type="button" onClick={() => propsFooter.onRequestClose?.('close')}>Cancel</button>
        <button type="button" onClick={() => propsFooter.onRequestCommit?.()} disabled={!allValid}>Save</button>
      </footer>
    );
  }, [filledSteps]);

  const headlessProps: HeadlessMultiStepDialogProps<any> = {
    open: props.open,
    stepComponents: stepDescriptors,
    stepData: { basic, frames },
    onStepDataChange: () => undefined,
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap: {},
    onRequestClose: () => props.onClose(),
    onRequestCommit: handleCommit,
    isDirty: true,
    renderHeader,
    renderContent,
    renderFooter,
  };

  return (
    <HeadlessMultiStepDialog {...headlessProps} />
  );
}

export async function getDialogComponent() {
  return TimelineDialog;
}
