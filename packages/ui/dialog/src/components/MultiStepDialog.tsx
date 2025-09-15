/**
 * Multi-step dialog component with React Router integration
 */

import React, { useCallback, useMemo, useState, useLayoutEffect, useRef, useEffect, ForwardedRef } from 'react';
import { Dialog, DialogTitle, Paper, PaperProps, GlobalStyles } from '@mui/material';
// Icons are used within header shell; no direct icon usage here
// (Header shell renders its own menu)
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { MultiStepShell } from './MultiStepShell';
import { MultiStepHeaderShell } from './MultiStepHeaderShell';
import type { FooterRenderProps, MultiStepDialogProps } from '../types/MultiStepDialog.types';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { useMultiStepController } from '../hooks/useMultiStepController';
import { useMultiStepPersistence } from '../hooks/useMultiStepPersistence';
import { useMultiStepA11y } from '../hooks/useMultiStepA11y';
import { useMultiStepKeyboard } from '../hooks/useMultiStepKeyboard';

// PaperComponent will be defined inside component to capture position/size state.

/**
 * Multi-step dialog component
 */
export const MultiStepDialog: React.FC<MultiStepDialogProps> = ({
                                                                  open,
                                                                  mode,
                                                                  title,
                                                                  icon,
                                                                  steps,
                                                                  currentData,
                                                                  evaluateSteps,
                                                                  evaluateSubmit,
                                                                  activeStep: controlledActiveStep,
                                                                  onStepChange,
                                                                  nonLinear = false,
                                                                  maxWidth: _maxWidth = 'lg',
                                                                  fullScreen: initialFullScreen = false,
                                                                  maximized: initialMaximized = false,
                                                                  onMaximizeChange,
                                                                  onFullscreenChange,
                                                                  displayMode,
                                                                  onDisplayModeChange,
                                                                  hasUnsavedChanges = false,
                                                                  supportsDraft = false,
                                                                  onSubmit,
                                                                  onSaveDraft,
                                                                  onCancel,
                                                                  onClose,
                                                                  renderFooter,
                                                                  headerActions,
                                                                  onStepTransition,
                                                                  loading = false,
                                                                  submitText = mode === 'create' ? 'Create' : 'Save',
                                                                  cancelText = 'Cancel',
                                                                  /* backText = 'Back', */
                                                                  nextText = 'Next',
                                                                  enableA11yTestControls = false,
                                                                  initialPosition,
                                                                  initialSize,
                                                                  onDialogMove,
                                                                  onDialogResize,
                                                                }) => {
  // Soft enforcement: warn when legacy props are used and legacy is disallowed.
  try {
    const allowLegacy = (globalThis as any)?.FEATURE_FLAGS?.UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE;
    const allowLegacyBool = String(allowLegacy ?? 'false').toLowerCase() === 'true' || String(allowLegacy ?? 'false') === '1';
    if (!allowLegacyBool) {
      if (initialFullScreen !== false || typeof onFullscreenChange === 'function' || initialMaximized !== false || typeof onMaximizeChange === 'function') {
        console.warn('[UI] Legacy display-mode props (fullScreen/maximized/*Change) are disabled by default. Use displayMode/onDisplayModeChange instead.');
      }
    }
  } catch (error){
    console.log("Can't access FEATURE_FLAGS.UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE", error);
  }
  // State
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isMaximized, setIsMaximized] = useState(initialMaximized);
  const [modeMenuAnchor, setModeMenuAnchor] = useState<null | HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // stepErrors are managed in controller now

  // Use controller for step state (controlled or uncontrolled)

  // Filter out skipped steps
  const visibleSteps = useMemo(
    () => steps.filter(step => !step.skip?.()),
    [steps],
  );

  // Prepare evaluated info once; controller consumes it for navigation rules
  const evaluated = useMemo(() => {
    if (!evaluateSteps) return { navigable: undefined as boolean[] | undefined, filled: undefined as boolean[] | undefined };
    try {
      const filled = evaluateSteps.getFilledSteps?.(currentData);
      const navigable = evaluateSteps.getNavigableSteps?.(currentData);
      return { navigable, filled };
    } catch {
      return { navigable: undefined, filled: undefined };
    }
  }, [evaluateSteps, currentData]);

  const ctrl = useMultiStepController({
    steps: visibleSteps as any,
    currentData,
    evaluateSubmit,
    nonLinear,
    loading,
    activeStep: (controlledActiveStep ?? internalActiveStep),
    onStepChange: onStepChange ?? ((n: number) => setInternalActiveStep(n)),
    onStepTransition,
    onSubmit,
    evaluated,
  });

  const currentStep = ctrl.currentStep;
  const currentStepConfig = ctrl.currentStepConfig as any;
  const isFirstStep = ctrl.isFirstStep;
  const isLastStep = ctrl.isLastStep;

  // Validation delegates to controller
  const validateCurrentStep = ctrl.validateCurrentStep;

  // evaluated already defined above; ctrl initialized

  const canGoNext = useMemo(() => {
    if (loading || isLastStep) return false;
    const filledOk = Array.isArray(evaluated.filled) ? !!evaluated.filled[currentStep] : true;
    const nextNavigable = Array.isArray(evaluated.navigable) && evaluated.navigable.length > currentStep + 1
      ? !!evaluated.navigable[currentStep + 1]
      : true;
    return filledOk && nextNavigable;
  }, [loading, isLastStep, evaluated.filled, evaluated.navigable, currentStep]);

  const canGoPrevious = currentStep > 0 && !loading;
  // const canSubmit = ctrl.canSubmit; // handled by shell via footerProps.loading/flow; keep for future if needed

  // Handle step change
  // const handleStepChange = ctrl.handleStepChange;

  // Navigation handlers
  const handleNext = ctrl.handleNext;

  const handleBack = ctrl.handleBack;

  const handleStepClick = ctrl.handleStepClick;

  // Close handlers
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose?.() || onCancel();
    }
  }, [hasUnsavedChanges, onClose, onCancel]);

  const handleDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    onClose?.() || onCancel();
  }, [onClose, onCancel]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;

    try {
      setIsSubmitting(true);
      await onSaveDraft();
      setShowUnsavedDialog(false);
      onClose?.() || onCancel();
    } catch (error) {
      console.error('Save draft failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSaveDraft, onClose, onCancel]);

  // Submit handler
  const handleSubmit = ctrl.handleSubmit;

  // Persistence (uncontrolledのみ). キーはタイトルで簡易に生成（外部 API 変更なし）
  useMultiStepPersistence({
    key: title ? `MultiStepDialog:${title}` : undefined,
    enabled: true,
    step: currentStep,
    setStep: (n) => setInternalActiveStep(n),
  });

  // A11y: ステップ遷移時にフォーカスを先頭要素へ
  useMultiStepA11y(paperRef as any, currentStep);

  // Keyboard shortcuts
  useMultiStepKeyboard({
    enabled: open,
    onNext: handleNext,
    onBack: handleBack,
    onSubmit: isLastStep ? () => handleSubmit() : undefined,
    onCancel: handleClose,
  });

  // --- Position (drag) / Size (resize) ---
  const [normalPos, setNormalPos] = useState<{ x: number; y: number }>(() => ({
    x: initialPosition?.x ?? (typeof window !== 'undefined' ? Math.max(16, Math.floor(window.innerWidth * 0.1)) : 20),
    y: initialPosition?.y ?? (typeof window !== 'undefined' ? Math.max(16, Math.floor(window.innerHeight * 0.1)) : 20),
  }));
  const [normalSize, setNormalSize] = useState<{ width: number; height: number }>(() => ({
    width: initialSize?.width ?? (typeof window !== 'undefined' ? Math.min(960, Math.floor(window.innerWidth * 0.8)) : 800),
    height: initialSize?.height ?? (typeof window !== 'undefined' ? Math.min(720, Math.floor(window.innerHeight * 0.7)) : 560),
  }));

  const displayPos = useMemo(() => {
    if (isFullscreen) return { x: 0, y: 0 };
    if (isMaximized) return { x: 8, y: 8 };
    return normalPos;
  }, [isFullscreen, isMaximized, normalPos]);

  const displaySize = useMemo(() => {
    if (typeof window === 'undefined') return normalSize;
    if (isFullscreen) return { width: window.innerWidth, height: window.innerHeight };
    if (isMaximized) return { width: Math.max(320, window.innerWidth - 16 * 2), height: Math.max(240, window.innerHeight - 16 * 2) };
    return normalSize;
  }, [isFullscreen, isMaximized, normalSize]);

  // Keep latest layout state in a ref so PaperComponent identity can be stable.
  const latestRef = useRef({
    isFullscreen,
    isMaximized,
    displayPos,
    displaySize,
    onDialogMove,
    onDialogResize,
  });
  latestRef.current.isFullscreen = isFullscreen;
  latestRef.current.isMaximized = isMaximized;
  latestRef.current.displayPos = displayPos as any;
  latestRef.current.displaySize = displaySize as any;
  latestRef.current.onDialogMove = onDialogMove;
  latestRef.current.onDialogResize = onDialogResize;

  // Draggable/Resizable Paper wrapper (stable identity to avoid focus loss)
  const PaperComponent = React.useMemo(() => React.forwardRef<HTMLDivElement, PaperProps>(function DraggableResizablePaper(p, ref: ForwardedRef<HTMLDivElement>) {
    const props = p;
    const { isFullscreen, isMaximized, displayPos, displaySize, onDialogMove, onDialogResize } = latestRef.current;
    // In fullscreen: render plain Paper (Dialog handles sizing)
    if (isFullscreen) {
      return <Paper {...props} ref={(el) => { (paperRef as any).current = el; if (typeof ref === 'function') ref(el as any); else if (ref) (ref as any).current = el; }} sx={{ width: '100%', height: '100%', m: 0 }} />;
    }

    // In maximized: render plain Paper but sized to displaySize
    if (isMaximized) {
      return (
        <Paper
          {...props}
          ref={(el) => { (paperRef as any).current = el; if (typeof ref === 'function') ref(el as any); else if (ref) (ref as any).current = el; }}
          sx={{ width: `${displaySize.width}px`, height: `${displaySize.height}px`, m: 0 }}
        />
      );
    }

    // Standard: resizable (outer) + draggable (inner)
    const dragNodeRef = React.useRef<HTMLDivElement>(null);
    const handleDragStop = (_e: any, data: { x: number; y: number }) => {
      const clamped = clampToViewport(data.x, data.y, displaySize.width, displaySize.height);
      setNormalPos(clamped);
      onDialogMove?.(clamped);
    };

    const handleResize = (_e: any, { size }: { size: { width: number; height: number } }) => {
      const clampedSize = clampSizeToViewport(size.width, size.height);
      setNormalSize(clampedSize);
      onDialogResize?.(clampedSize);
    };

    return (
      <Resizable
        width={displaySize.width}
        height={displaySize.height}
        onResize={handleResize}
        resizeHandles={[ 'se', 'e', 's' ]}
        minConstraints={[ 360, 280 ]}
      >
        {/* Resizable requires a DOM element child that accepts className/style */}
        <div style={{ width: `${displaySize.width}px`, height: `${displaySize.height}px` }}>
          <Draggable
            nodeRef={dragNodeRef}
            handle="#draggable-dialog-title"
            cancel={'.react-resizable-handle, [class*="MuiDialogContent-root"]'}
            defaultPosition={{ x: displayPos.x, y: displayPos.y }}
            onStop={handleDragStop}
          >
            <div ref={dragNodeRef}>
              <Paper
                {...props}
                ref={(el) => { (paperRef as any).current = el; if (typeof ref === 'function') ref(el as any); else if (ref) (ref as any).current = el; }}
                sx={{ width: '100%', height: '100%', m: 0 }}
              />
            </div>
          </Draggable>
        </div>
      </Resizable>
    );
  }), []);

  // Helpers: clamp to viewport to avoid losing the dialog off-screen
  // Policy A: Ensure the draggable handle (dialog title's left edge) stays visible,
  // allowing right/bottom overflow. Only top-left anchor is constrained in-viewport.
  const clampToViewport = (x: number, y: number, _w: number, _h: number) => {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(8, window.innerWidth - 8); // keep left edge within viewport
    const maxY = Math.max(8, window.innerHeight - 8); // keep top edge within viewport
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  };
  const clampSizeToViewport = (w: number, h: number) => {
    if (typeof window === 'undefined') return { width: w, height: h };
    const maxW = Math.max(320, window.innerWidth - 16);
    const maxH = Math.max(240, window.innerHeight - 16);
    return { width: Math.min(Math.max(360, w), maxW), height: Math.min(Math.max(280, h), maxH) };
  };

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    if (next) {
      const el: any = paperRef.current;
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen;
      if (typeof req === 'function') {
        try {
          req.call(el).then?.(() => {
            setIsFullscreen(true);
            onFullscreenChange?.(true);
          }).catch?.(() => {
            // Fallback to viewport fullscreen
            setIsFullscreen(true);
            onFullscreenChange?.(true);
          });
          return;
        } catch {
          // Fallback to viewport fullscreen
        }
      }
      // Fallback when Fullscreen API is unavailable
      setIsFullscreen(true);
      onFullscreenChange?.(true);
      onDisplayModeChange?.('fullscreen');
    } else {
      // Turn off fullscreen
      if (document.fullscreenElement) {
        try { document.exitFullscreen?.(); } catch {
          console.error('Failed to exit fullscreen');
        }
      }
      setIsFullscreen(false);
      onFullscreenChange?.(false);
      // fullscreen解除時は、最大化が有効でなければ standard
      onDisplayModeChange?.(isMaximized ? 'maximized' : 'standard');
    }
  }, [isFullscreen, isMaximized, onDisplayModeChange, onFullscreenChange]);

  // Keep in sync with browser-level fullscreen changes (ESC, OS shortcuts)
  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      onFullscreenChange?.(active);
      onDisplayModeChange?.(active ? 'fullscreen' : (isMaximized ? 'maximized' : 'standard'));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // Safari legacy events
    document.addEventListener('webkitfullscreenchange' as any, onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange' as any, onFsChange);
    };
  }, [isMaximized, onDisplayModeChange, onFullscreenChange]);

  const toggleMaximize = useCallback(() => {
    const next = !isMaximized;
    setIsMaximized(next);
    onMaximizeChange?.(next);
    if (!isFullscreen) onDisplayModeChange?.(next ? 'maximized' : 'standard');
  }, [isFullscreen, isMaximized, onDisplayModeChange, onMaximizeChange]);

  // Display-mode menu handlers
  const openModeMenu = useCallback((e: React.MouseEvent<HTMLElement>) => setModeMenuAnchor(e.currentTarget), []);
  const closeModeMenu = useCallback(() => setModeMenuAnchor(null), []);
  const selectDisplayMode = useCallback((mode: 'standard' | 'maximized' | 'fullscreen') => {
    if (mode === 'fullscreen') {
      if (!isFullscreen) toggleFullscreen();
      if (isMaximized) toggleMaximize();
    } else if (mode === 'maximized') {
      if (isFullscreen) toggleFullscreen();
      if (!isMaximized) toggleMaximize();
    } else {
      if (isFullscreen) toggleFullscreen();
      if (isMaximized) toggleMaximize();
    }
    closeModeMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, isMaximized, toggleFullscreen, toggleMaximize]);

  // 制御モード：displayMode prop から内部状態に反映
  useEffect(() => {
    if (!displayMode) return;
    if (displayMode === 'fullscreen') {
      if (!isFullscreen) toggleFullscreen();
      if (isMaximized) setIsMaximized(false);
    } else if (displayMode === 'maximized') {
      if (isFullscreen) {
        // 可能なら退出
        try { if (document.fullscreenElement) void document.exitFullscreen?.(); } catch {
          console.warn('Failed to exit fullscreen');
        }
        setIsFullscreen(false);
      }
      setIsMaximized(true);
    } else {
      // standard
      if (isFullscreen) {
        try { if (document.fullscreenElement) void document.exitFullscreen?.(); } catch {
          console.warn('Failed to exit fullscreen');
        }
        setIsFullscreen(false);
      }
      setIsMaximized(false);
    }
    // 注: ブラウザの Fullscreen API 仕様により、ユーザー操作無しでの requestFullscreen は拒否される場合がある点を許容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  // Validate on mount and step change
  useLayoutEffect(() => {
    void validateCurrentStep();
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Footer props
  const footerProps: FooterRenderProps = {
    currentStep,
    totalSteps: visibleSteps.length,
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoPrevious,
    onNext: handleNext,
    onBack: handleBack,
    onSubmit: handleSubmit,
    onCancel: handleClose,
    loading: loading || isSubmitting,
  };

  return (
    <>
      <Dialog
        PaperComponent={PaperComponent}
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth={false}
        fullScreen={isFullscreen}
        disableEscapeKeyDown={hasUnsavedChanges}
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', justifyContent: 'flex-start' } }}
        // Testing-friendly settings to reduce async focus/transition updates
        disablePortal
        disableAutoFocus
        disableEnforceFocus
        keepMounted
        TransitionProps={{ timeout: 0 }}
        role="dialog"
        aria-modal="true"
        slotProps={{
          paper: { ref: paperRef },
        }}
      >
        {/* Resizable handle styles (react-resizable) */}
        <GlobalStyles styles={{
          '.react-resizable-handle': {
            position: 'absolute',
            display: 'block',
            background: 'transparent',
            zIndex: 1000,
          },
          '.react-resizable-handle-se': {
            width: '14px', height: '14px', right: '2px', bottom: '2px', cursor: 'se-resize',
            borderRight: '2px solid rgba(0,0,0,0.25)', borderBottom: '2px solid rgba(0,0,0,0.25)',
          },
          '.react-resizable-handle-e': {
            width: '10px', right: 0, top: 0, bottom: 0, cursor: 'e-resize',
          },
          '.react-resizable-handle-s': {
            height: '10px', left: 0, right: 0, bottom: 0, cursor: 's-resize',
          },
        }} />
        {/* Header */}
        <DialogTitle sx={{ py: 0.5, px: 1, cursor:'move', minHeight: 0 }} id="draggable-dialog-title">
          <MultiStepHeaderShell
            icon={icon}
            title={title}
            headerActions={headerActions}
            isFullscreen={isFullscreen}
            isMaximized={isMaximized}
            openModeMenu={openModeMenu}
            closeModeMenu={closeModeMenu}
            modeMenuAnchor={modeMenuAnchor}
            selectDisplayMode={selectDisplayMode}
            onClose={handleClose}
          />
        </DialogTitle>

        <MultiStepShell
          steps={visibleSteps as any}
          activeStep={currentStep}
          completedSteps={ctrl.completedSteps}
          nonLinear={nonLinear}
          navigable={evaluated.navigable}
          onStepClick={handleStepClick}
          loading={loading}
          isSubmitting={isSubmitting}
          currentStepNode={currentStepConfig?.component}
          currentStepError={ctrl.stepErrors.get(currentStep)}
          renderFooter={renderFooter}
          footerProps={footerProps}
          submitText={submitText}
          nextText={nextText}
          cancelText={cancelText}
          enableA11yTestControls={enableA11yTestControls}
        />
      </Dialog>

      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        showSaveDraft={supportsDraft && !!onSaveDraft}
        onDiscard={handleDiscard}
        onSaveDraft={handleSaveDraft}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </>
  );
};
