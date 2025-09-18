import { memo } from 'react';
import { useMultiStepDialogContext } from './context.js';
import type {
  HeadlessContentRenderProps,
  HeadlessMultiDialogContentProps,
  StepComponentProps,
} from './types.js';

function buildContentRenderProps<TData>(ctx: ReturnType<typeof useMultiStepDialogContext<TData>>): HeadlessContentRenderProps<TData> {
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

function renderDefaultStep<TData>(ctx: ReturnType<typeof useMultiStepDialogContext<TData>>) {
  const descriptor = ctx.stepComponents[ctx.activeStepIndex];
  if (!descriptor) {
    return null;
  }
  const StepComponent = descriptor.component;
  const stepProps: StepComponentProps<TData> = {
    stepIndex: ctx.activeStepIndex,
    stepId: descriptor.id,
    label: descriptor.label,
    data: ctx.stepData,
    onChange: ctx.onStepDataChange,
    invalidMessages: ctx.invalidMessageMap,
  };
  return <StepComponent {...stepProps} />;
}

function MultiDialogContentComponent<TData>({ children }: HeadlessMultiDialogContentProps<TData>) {
  const ctx = useMultiStepDialogContext<TData>();
  if (children) {
    const renderProps = buildContentRenderProps(ctx);
    return <>{children(renderProps)}</>;
  }
  return renderDefaultStep(ctx);
}

MultiDialogContentComponent.displayName = 'HeadlessMultiDialogContent';

export const MultiDialogContent = memo(MultiDialogContentComponent) as <TData,>(
  props: HeadlessMultiDialogContentProps<TData>,
) => JSX.Element | null;
