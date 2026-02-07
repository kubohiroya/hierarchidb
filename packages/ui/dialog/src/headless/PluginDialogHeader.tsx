import { memo } from 'react';
import { useDialogContext } from '../hooks/useDialogContext.js';
import type { HeadlessHeaderRenderProps, HeadlessDialogHeaderProps } from './types.js';

function buildHeaderRenderProps<TData>(ctx: ReturnType<typeof useDialogContext<TData>>): HeadlessHeaderRenderProps<TData> {
  return {
    steps: ctx.stepComponents,
    activeStepIndex: ctx.activeStepIndex,
    enabledStepIndices: ctx.enabledStepIndices,
    validatedStepIndices: ctx.validatedStepIndices,
    committableStepIndices: ctx.committableStepIndices,
    displayMode: ctx.displayMode ?? 'normal',
    allowFullScreen: ctx.allowFullScreen,
    onDisplayModeChange: ctx.onDisplayModeChange,
    isMinimized: ctx.isMinimized,
    onMinimizeChange: ctx.onMinimizeChange,
    stepNavigation: ctx.onStepNavigate,
    isDirty: ctx.isDirty,
    onRequestClose: ctx.onRequestClose,
  };
}

function PluginDialogHeaderComponent<TData>({ children }: HeadlessDialogHeaderProps<TData>) {
  const ctx = useDialogContext<TData>();
  if (!children) {
    return null;
  }

  const renderProps = buildHeaderRenderProps(ctx);
  return <>{children(renderProps)}</>;
}

PluginDialogHeaderComponent.displayName = 'HeadlessPluginDialogHeader';

export const PluginDialogHeader = memo(PluginDialogHeaderComponent) as <TData,>(
  props: HeadlessDialogHeaderProps<TData>,
) => JSX.Element | null;
