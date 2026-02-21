import { memo } from 'react';
import type { ReactElement } from 'react';
import { useDialogContext } from '~/hooks/useDialogContext';
import type { HeadlessFooterRenderProps, HeadlessDialogFooterProps } from './types.js';

function buildFooterRenderProps<TData>(ctx: ReturnType<typeof useDialogContext<TData>>): HeadlessFooterRenderProps<TData> {
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

function PluginDialogFooterComponent<TData>({ children }: HeadlessDialogFooterProps<TData>) {
  const ctx = useDialogContext<TData>();
  if (!children) {
    return null;
  }
  const renderProps = buildFooterRenderProps(ctx);
  return <>{children(renderProps)}</>;
}

PluginDialogFooterComponent.displayName = 'HeadlessPluginDialogFooter';

export const PluginDialogFooter = memo(PluginDialogFooterComponent) as <TData,>(
  props: HeadlessDialogFooterProps<TData>,
) => ReactElement | null;
