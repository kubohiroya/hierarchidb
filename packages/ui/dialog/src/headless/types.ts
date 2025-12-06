import type { ReactNode, ComponentType, PointerEvent as ReactPointerEvent } from 'react';

/** Step navigation commands emitted by the dialog shell. */
export type StepNavigationEvent =
  | { type: 'direct'; targetIndex: number }
  | { type: 'next' }
  | { type: 'back' };

/** Display mode handled by the dialog frame. */
export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

/** Visibility policy for header / footer elements. */
export type SectionVisibilityMode = 'visible' | 'hidden' | 'auto';

/**
 * Props exposed to step components. The consumer-defined component receives
 * the slice of form data, helper callbacks, and contextual metadata.
 */
export interface StepComponentProps<TData> {
  stepIndex: number;
  stepId: string;
  label: string;
  data: TData;
  onChange: (patch: Partial<TData>) => void;
  invalidMessages: Readonly<Record<string, string>>;
}

export interface StepComponentDescriptor<TData> {
  id: string;
  label: string;
  component: ComponentType<StepComponentProps<TData>>;
  metadata?: Record<string, unknown>;
}

export interface MultiStepDialogPosition {
  x: number;
  y: number;
}

export interface MultiStepDialogSize {
  width: number;
  height: number;
}

export interface HeadlessHeaderRenderProps<TData> {
  steps: ReadonlyArray<StepComponentDescriptor<TData>>;
  activeStepIndex: number;
  enabledStepIndices: ReadonlyArray<number>;
  validatedStepIndices: ReadonlyArray<number>;
  committableStepIndices: ReadonlyArray<number>;
  displayMode: DialogDisplayMode;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
  stepNavigation: (event: StepNavigationEvent) => void;
  isDirty: boolean;
  onRequestClose: (reason?: 'close' | 'discard') => void;
}

export interface HeadlessContentRenderProps<TData> {
  steps: ReadonlyArray<StepComponentDescriptor<TData>>;
  activeStepIndex: number;
  activeStep?: StepComponentDescriptor<TData>;
  stepData: TData;
  onStepDataChange: (patch: Partial<TData>) => void;
  invalidMessageMap: Readonly<Record<string, string>>;
}

export interface HeadlessFooterRenderProps<TData> {
  steps: ReadonlyArray<StepComponentDescriptor<TData>>;
  activeStepIndex: number;
  enabledStepIndices: ReadonlyArray<number>;
  validatedStepIndices: ReadonlyArray<number>;
  committableStepIndices: ReadonlyArray<number>;
  stepNavigation: (event: StepNavigationEvent) => void;
  onRequestClose: (reason?: 'close' | 'discard') => void;
  onRequestCommit?: () => void;
  isDirty: boolean;
  invalidMessageMap: Readonly<Record<string, string>>;
}

export interface MultiStepDialogFrameProps {
  position?: MultiStepDialogPosition;
  onPositionChange?: (next: MultiStepDialogPosition) => void;
  size?: MultiStepDialogSize;
  onSizeChange?: (next: MultiStepDialogSize) => void;
  displayMode?: DialogDisplayMode;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
  headerDisplayMode?: SectionVisibilityMode;
  footerDisplayMode?: SectionVisibilityMode;
  headerHoverZoneHeight?: number;
  footerHoverZoneHeight?: number;
  onHeaderVisibilityChange?: (visible: boolean) => void;
  onFooterVisibilityChange?: (visible: boolean) => void;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface HeadlessMultiStepDialogProps<TData> extends MultiStepDialogFrameProps {
  open: boolean;
  stepComponents: ReadonlyArray<StepComponentDescriptor<TData>>;
  stepData: TData;
  onStepDataChange: (patch: Partial<TData>) => void;
  activeStepIndex: number;
  enabledStepIndices?: ReadonlyArray<number>;
  validatedStepIndices?: ReadonlyArray<number>;
  committableStepIndices?: ReadonlyArray<number>;
  invalidMessageMap?: Readonly<Record<string, string>>;
  isDirty?: boolean;
  onStepNavigate: (event: StepNavigationEvent) => void;
  onRequestClose: (reason?: 'close' | 'discard') => void;
  onRequestCommit?: () => void;

  HeaderComponent?: ComponentType<HeadlessMultiStepDialogHeaderProps<TData>>;
  ContentComponent?: ComponentType<HeadlessMultiStepDialogContentProps<TData>>;
  FooterComponent?: ComponentType<HeadlessMultiStepDialogFooterProps<TData>>;
  renderHeader?: (props: HeadlessHeaderRenderProps<TData>) => ReactNode;
  renderFooter?: (props: HeadlessFooterRenderProps<TData>) => ReactNode;
}

export interface HeadlessMultiStepDialogHeaderProps<TData> {
  children?: (props: HeadlessHeaderRenderProps<TData>) => ReactNode;
}

export interface HeadlessMultiStepDialogContentProps<TData> {
  children?: (props: HeadlessContentRenderProps<TData>) => ReactNode;
}

export interface HeadlessMultiStepDialogFooterProps<TData> {
  children?: (props: HeadlessFooterRenderProps<TData>) => ReactNode;
}

export interface HeadlessMultiStepDialogContextValue<TData> extends MultiStepDialogFrameProps {
  open: boolean;
  stepComponents: ReadonlyArray<StepComponentDescriptor<TData>>;
  stepData: TData;
  onStepDataChange: (patch: Partial<TData>) => void;
  activeStepIndex: number;
  enabledStepIndices: ReadonlyArray<number>;
  validatedStepIndices: ReadonlyArray<number>;
  committableStepIndices: ReadonlyArray<number>;
  invalidMessageMap: Readonly<Record<string, string>>;
  isDirty: boolean;
  onStepNavigate: (event: StepNavigationEvent) => void;
  onRequestClose: (reason?: 'close' | 'discard') => void;
  onRequestCommit?: () => void;
}
