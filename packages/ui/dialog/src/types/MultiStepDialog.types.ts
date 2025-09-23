/**
 * Multi-step dialog type definitions
 */

import { ReactNode } from 'react';

/**
 * Dialog mode - create or edit
 */
export type DialogMode = 'create' | 'edit';

/**
 * Step validation function signature
 */
export type StepValidationFn = () => boolean | Promise<boolean>;

/**
 * Step transition hook signature
 */
export type StepTransitionHook = (
  fromStep: number,
  toStep: number,
) => boolean | Promise<boolean>;

/**
 * External step state evaluator supplied by plugins/hosts.
 * Returns boolean arrays (length = steps.length).
 */
export interface StepStateEvaluator {
  /** Which steps are navigable at this moment (index-based). */
  getNavigableSteps: (data: any, stepNumbers?: number[]) => boolean[];
  /** Which steps are currently filled (all required inputs satisfied). */
  getFilledSteps: (data: any, stepNumbers?: number[]) => boolean[];
}

/** Submit eligibility evaluator */
export type SubmitEligibilityFn = (data: any) => boolean | Promise<boolean>;

/**
 * Step capability checks
 */
export interface StepCapabilities {
  /** Whether this step can be navigated to directly */
  canNavigateTo: (fromStep: number, data: any) => boolean | Promise<boolean>;

  /** Whether batch processing can start from this step */
  canStartBatch: (data: any) => boolean | Promise<boolean>;

  /** Whether the dialog can be saved and closed from this step */
  canSave: (data: any) => boolean | Promise<boolean>;

  /** Whether can proceed to next step */
  canProceedToNext: (data: any) => boolean | Promise<boolean>;

  /** Whether can go back to previous step */
  canBackToPrevious: (data: any) => boolean | Promise<boolean>;
}

/**
 * Individual step configuration
 */
export interface DialogStep {
  /** Step identifier */
  id: string;

  /** Display label for the step */
  label: string;

  /** Optional description */
  description?: string;

  /** Step content component */
  component: ReactNode;

  /** Validation function for this step */
  validate?: StepValidationFn;

  /** Step capability checks */
  capabilities?: StepCapabilities;

  /** Whether this step is optional */
  optional?: boolean;

  /** Whether to skip this step based on condition */
  skip?: () => boolean;

  /** Custom icon for the step */
  icon?: ReactNode;

  /** Hook called when entering this step */
  onEnter?: () => void | Promise<void>;

  /** Hook called when leaving this step */
  onLeave?: () => void | Promise<void>;
}

/**
 * Multi-step dialog props
 */
export interface MultiStepDialogProps {
  /** Dialog open state */
  open: boolean;

  /** Dialog mode */
  mode: DialogMode;

  /** Dialog title */
  title: string;

  /** Optional subtitle */
  subtitle?: string;

  /** Dialog icon */
  icon?: ReactNode;

  /** Array of step configurations */
  steps: DialogStep[];

  /** Current form/entity data for evaluation */
  currentData?: any;

  /** External evaluator to decide navigability and filled states */
  evaluateSteps?: StepStateEvaluator;

  /** External submit eligibility evaluator */
  evaluateSubmit?: SubmitEligibilityFn;

  /** Current active step (for controlled mode) */
  activeStep?: number;

  /** Callback when step changes */
  onStepChange?: (step: number) => void;

  /** Allow non-linear navigation between steps */
  nonLinear?: boolean;

  /** Dialog max width */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

  /** Initial display mode for uncontrolled usage */
  initialDisplayMode?: import('../headless/types.js').DialogDisplayMode;

  /** Has unsaved changes */
  hasUnsavedChanges?: boolean;

  /** Supports draft mode */
  supportsDraft?: boolean;

  /** Submit handler */
  onSubmit: (data?: any) => void | Promise<void>;

  /** Save as draft handler */
  onSaveDraft?: (data?: any) => void | Promise<void>;

  /** Cancel handler */
  onCancel: () => void;

  /** Close handler */
  onClose?: () => void;

  /** Custom footer renderer */
  renderFooter?: (props: FooterRenderProps) => ReactNode;

  /** Custom header actions */
  headerActions?: ReactNode;

  /** Step transition hook */
  onStepTransition?: StepTransitionHook;

  /** Loading state */
  loading?: boolean;

  /** Submit button text */
  submitText?: string;

  /** Cancel button text */
  cancelText?: string;

  /** Back button text */
  backText?: string;

  /** Next button text */
  nextText?: string;

  /**
   * 表示モード（制御用）。指定時は内部 state をこの値に追従させる。
   * - 'normal': 通常サイズ
   * - 'maximize': ウィンドウ内で可能な限り拡大
   * - 'full-screen': ブラウザ Fullscreen API によるモニタ全面表示
   */
  displayMode?: import('../headless/types.js').DialogDisplayMode;
  /** 表示モード変更時のコールバック（制御モードで利用） */
  onDisplayModeChange?: (mode: import('../headless/types.js').DialogDisplayMode) => void;
  /** 表示モードのクイック切替 UI を表示するか（既定: true）。 */
  showDisplayModeControls?: boolean;

  /** @deprecated `displayMode`/`onDisplayModeChange` へ移行済み。 */
  fullScreen?: boolean;
  /** @deprecated `displayMode`/`onDisplayModeChange` へ移行済み。 */
  onFullscreenChange?: (fullScreen: boolean) => void;
  /** @deprecated `displayMode`/`onDisplayModeChange` へ移行済み。 */
  maximized?: boolean;
  /** @deprecated `displayMode`/`onDisplayModeChange` へ移行済み。 */
  onMaximizeChange?: (maximized: boolean) => void;
  /** @deprecated `showDisplayModeControls` で一括制御。 */
  showFullscreenToggle?: boolean;
  /** @deprecated `showDisplayModeControls` で一括制御。 */
  showMaximizeToggle?: boolean;

  /**
   * Enable hidden a11y test controls (Cancel/Next/Complete buttons rendered off-screen).
   * Tests can set this true to drive the dialog via aria-labels without relying on focus.
   * Defaults to false and should never be enabled in production UI.
   */
  enableA11yTestControls?: boolean;

  /**
   * Initial dialog position (standard modeのみで使用)。
   * ドラッグ操作で更新され、onDialogMove が呼び出されます。
   */
  initialPosition?: { x: number; y: number };

  /**
   * Initial dialog size (standard modeのみで使用)。
   * リサイズ操作で更新され、onDialogResize が呼び出されます。
   */
  initialSize?: { width: number; height: number };

  /** 親へダイアログの移動を通知 */
  onDialogMove?: (pos: { x: number; y: number }) => void;

  /** 親へダイアログのリサイズを通知 */
  onDialogResize?: (size: { width: number; height: number }) => void;
}

/**
 * Footer render props
 */
export interface FooterRenderProps {
  /** Current step index */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Whether on first step */
  isFirstStep: boolean;

  /** Whether on last step */
  isLastStep: boolean;

  /** Whether can navigate to next step */
  canGoNext: boolean;

  /** Whether can navigate to previous step */
  canGoPrevious: boolean;

  /** Navigate to next step */
  onNext: () => void;

  /** Navigate to previous step */
  onBack: () => void;

  /** Submit the dialog */
  onSubmit: () => void;

  /** Cancel the dialog */
  onCancel: () => void;

  /** Loading state */
  loading: boolean;
}

/**
 * Stepper component props
 */
export interface StepperProps {
  /** Array of steps */
  steps: DialogStep[];

  /** Current active step */
  activeStep: number;

  /** Whether steps have been completed */
  completedSteps: Set<number>;

  /** Navigate to step handler */
  onStepClick?: (step: number) => void;

  /** Non-linear navigation enabled */
  nonLinear?: boolean;

  /** Use alternative label placement for many steps */
  alternativeLabel?: boolean;
}
