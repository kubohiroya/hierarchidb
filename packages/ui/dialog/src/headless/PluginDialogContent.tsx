import { memo } from 'react';
import { useDialogContext } from '../hooks/useDialogContext.js';
import type {
  HeadlessContentRenderProps,
  HeadlessDialogContentProps,
  PluginStepProps,
} from './types.js';

function buildContentRenderProps<TData>(ctx: ReturnType<typeof useDialogContext<TData>>): HeadlessContentRenderProps<TData> {
  const activeStep = ctx.stepComponents[ctx.activeStepIndex];
  return {
    steps: ctx.stepComponents,
    activeStepIndex: ctx.activeStepIndex,
    activeStep,
    stepData: ctx.stepData,
    onStepDataChange: ctx.onStepDataChange,
    invalidMessageMap: ctx.invalidMessageMap,
  };
}

function renderActiveStep<TData>(ctx: ReturnType<typeof useDialogContext<TData>>) {
  const descriptor = ctx.stepComponents[ctx.activeStepIndex];
  if (!descriptor) {
    return null;
  }
  const StepComponent = descriptor.component;
  const stepProps: PluginStepProps<TData> = {
    stepIndex: ctx.activeStepIndex,
    stepId: descriptor.id,
    label: descriptor.label,
    data: ctx.stepData,
    onChange: ctx.onStepDataChange,
    invalidMessages: ctx.invalidMessageMap,
  };
  return <StepComponent {...stepProps} />;
}

function PluginDialogContentComponent<TData>({ children }: HeadlessDialogContentProps<TData>) {
  const ctx = useDialogContext<TData>();
  if (children) {
    const renderProps = buildContentRenderProps(ctx);
    return <>{children(renderProps)}</>;
  }
  return renderActiveStep(ctx);
}

PluginDialogContentComponent.displayName = 'HeadlessPluginDialogContent';

export const PluginDialogContent = memo(PluginDialogContentComponent) as <TData,>(
  props: HeadlessDialogContentProps<TData>,
) => JSX.Element | null;
