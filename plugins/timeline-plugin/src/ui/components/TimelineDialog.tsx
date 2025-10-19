import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
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
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type StepComponentDescriptor,
  type StepNavigationEvent,
  type DialogDisplayMode,
  type MultiDialogSize,
  type MultiDialogPosition,
} from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoValues } from '../steps/BasicInfoStep.js';
import { FramesPreviewStep, type TimelineFrame } from '../steps/FramesPreviewStep.js';
import { MapPreviewStep } from '../steps/MapPreviewStep.js';
import { AnimationViewerStep } from '../steps/AnimationViewerStep.js';

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

  const viewportOnMount = getViewportSize();
  const defaultSize = getPresetSize('normal', viewportOnMount);
  const initialLayout = normalizeDialogState(
    defaultSize,
    initialPosition(defaultSize, viewportOnMount),
    viewportOnMount,
    { enforceTopLeftMargin: true },
  );

  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>('normal');
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
    .filter((idx) => idx >= 0), [filledSteps]);

  const validatedStepIndices = useMemo(() => filledSteps
    .map((valid, idx) => (valid ? idx : -1))
    .filter((idx) => idx >= 0), [filledSteps]);

  const committableStepIndices = useMemo(() => (steps.length ? [steps.length - 1] : []), [steps.length]);

  const dialogTitle = useMemo(() => (props.mode === 'create' ? 'Create Timeline' : 'Edit Timeline'), [props.mode]);

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

  const handleCommit = useCallback(() => {
    props.onSuccess(props.nodeId || 'timeline-new');
  }, [props]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<any>>>(() => (
    steps.map((step) => ({ id: step.id, label: step.label, component: () => null }))
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

    setDisplayMode(mode);
  }, [applyNormalizedState, setDisplayMode]);

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
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (mode) => { transitionDisplayMode(mode); },
    renderHeader,
    renderContent,
    renderFooter,
  };

  const frameStyle = useMemo((): CSSProperties => {
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
    <div style={frameStyle} role="dialog" aria-modal={props.open}>
      <HeadlessMultiStepDialog {...headlessProps} />
    </div>
  );
}

export async function getDialogComponent() {
  return TimelineDialog;
}
