import { DialogDisplayMode, DialogPosition, DialogSize } from '@hierarchidb/tree-api';
import type { ComponentType, ReactNode, PointerEvent as ReactPointerEvent } from 'react';

export type StepDraftCommitter<TData> = () =>
  | Partial<TData>
  | void
  | Promise<Partial<TData> | void>;

/** Step navigation commands emitted by the dialog shell. */
export type StepNavigationEvent =
  | { type: 'direct'; targetIndex: number }
  | { type: 'next' }
  | { type: 'back' };

/** Visibility policy for header / footer elements. */
export type SectionVisibilityMode = 'visible' | 'hidden' | 'auto';

/**
 * Props exposed to step components. The consumer-defined component receives
 * the slice of form data, helper callbacks, and contextual metadata.
 */
export interface PluginStepProps<TData> {
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
  component: ComponentType<PluginStepProps<TData>>;
  metadata?: Record<string, unknown>;
}

export interface HeadlessHeaderRenderProps<TData> {
  steps: ReadonlyArray<StepComponentDescriptor<TData>>;
  activeStepIndex: number;
  enabledStepIndices: ReadonlyArray<number>;
  validatedStepIndices: ReadonlyArray<number>;
  committableStepIndices: ReadonlyArray<number>;
  displayMode: DialogDisplayMode;
  allowFullScreen?: boolean;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
  isMinimized?: boolean;
  onMinimizeChange?: (next: boolean) => void;
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

export interface DialogFrameProps {
  position?: DialogPosition;
  onPositionChange?: (next: DialogPosition) => void;
  size?: DialogSize;
  onSizeChange?: (next: DialogSize) => void;
  displayMode?: DialogDisplayMode;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
  allowFullScreen?: boolean;
  isMinimized?: boolean;
  onMinimizeChange?: (next: boolean) => void;
  frameless?: boolean;
  transparent?: boolean;
  removePaddingWithFullScreenMode?: boolean;
  headerDisplayMode?: SectionVisibilityMode;
  footerDisplayMode?: SectionVisibilityMode;
  headerHoverZoneHeight?: number;
  footerHoverZoneHeight?: number;
  onHeaderVisibilityChange?: (visible: boolean) => void;
  onFooterVisibilityChange?: (visible: boolean) => void;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface HeadlessDialogProps<TData> extends DialogFrameProps {
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
  registerStepDraftCommitter?: (committer: StepDraftCommitter<TData>) => void | (() => void);

  HeaderComponent?: ComponentType<HeadlessDialogHeaderProps<TData>>;
  ContentComponent?: ComponentType<HeadlessDialogContentProps<TData>>;
  FooterComponent?: ComponentType<HeadlessDialogFooterProps<TData>>;
  renderHeader?: (props: HeadlessHeaderRenderProps<TData>) => ReactNode;
  renderFooter?: (props: HeadlessFooterRenderProps<TData>) => ReactNode;
}

export interface HeadlessDialogHeaderProps<TData> {
  children?: (props: HeadlessHeaderRenderProps<TData>) => ReactNode;
}

export interface HeadlessDialogContentProps<TData> {
  children?: (props: HeadlessContentRenderProps<TData>) => ReactNode;
}

export interface HeadlessDialogFooterProps<TData> {
  children?: (props: HeadlessFooterRenderProps<TData>) => ReactNode;
}

export interface HeadlessDialogContextValue<TData> extends DialogFrameProps {
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
  registerStepDraftCommitter?: (committer: StepDraftCommitter<TData>) => void | (() => void);
}
