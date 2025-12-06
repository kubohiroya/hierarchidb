import { memo } from 'react';
import { useMultiStepDialogContext } from '../hooks/useMultiStepDialogContext.js';
import type { HeadlessFooterRenderProps, HeadlessMultiStepDialogFooterProps } from './types.js';

function buildFooterRenderProps<TData>(ctx: ReturnType<typeof useMultiStepDialogContext<TData>>): HeadlessFooterRenderProps<TData> {
  return {
    steps: ctx.stepComponents,
    activeStepIndex: ctx.activeStepIndex,
    enabledStepIndices: ctx.enabledStepIndices,
    validatedStepIndices: ctx.validatedStepIndices,
    committableStepIndices: ctx.committableStepIndices,
    stepNavigation: ctx.onStepNavigate,
    onRequestClose: ctx.onRequestClose,
    onRequestCommit: ctx.onRequestCommit,
    isDirty: ctx.isDirty,
    invalidMessageMap: ctx.invalidMessageMap,
  };
}

function MultiStepDialogFooterComponent<TData>({ children }: HeadlessMultiStepDialogFooterProps<TData>) {
  const ctx = useMultiStepDialogContext<TData>();
  if (!children) {
    return null;
  }
  const renderProps = buildFooterRenderProps(ctx);
  return <>{children(renderProps)}</>;
}

MultiStepDialogFooterComponent.displayName = 'HeadlessMultiStepDialogFooter';

export const MultiStepDialogFooter = memo(MultiStepDialogFooterComponent) as <TData,>(
  props: HeadlessMultiStepDialogFooterProps<TData>,
) => JSX.Element | null;
