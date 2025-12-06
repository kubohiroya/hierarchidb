import { memo } from 'react';
import { useMultiStepDialogContext } from '../hooks/useMultiStepDialogContext.js';
import type { HeadlessHeaderRenderProps, HeadlessMultiStepDialogHeaderProps } from './types.js';

function buildHeaderRenderProps<TData>(ctx: ReturnType<typeof useMultiStepDialogContext<TData>>): HeadlessHeaderRenderProps<TData> {
  return {
    steps: ctx.stepComponents,
    activeStepIndex: ctx.activeStepIndex,
    enabledStepIndices: ctx.enabledStepIndices,
    validatedStepIndices: ctx.validatedStepIndices,
    committableStepIndices: ctx.committableStepIndices,
    displayMode: ctx.displayMode ?? 'normal',
    onDisplayModeChange: ctx.onDisplayModeChange,
    stepNavigation: ctx.onStepNavigate,
    isDirty: ctx.isDirty,
    onRequestClose: ctx.onRequestClose,
  };
}

function MultiStepDialogHeaderComponent<TData>({ children }: HeadlessMultiStepDialogHeaderProps<TData>) {
  const ctx = useMultiStepDialogContext<TData>();
  if (!children) {
    return null;
  }

  const renderProps = buildHeaderRenderProps(ctx);
  return <>{children(renderProps)}</>;
}

MultiStepDialogHeaderComponent.displayName = 'HeadlessMultiStepDialogHeader';

export const MultiStepDialogHeader = memo(MultiStepDialogHeaderComponent) as <TData,>(
  props: HeadlessMultiStepDialogHeaderProps<TData>,
) => JSX.Element | null;
