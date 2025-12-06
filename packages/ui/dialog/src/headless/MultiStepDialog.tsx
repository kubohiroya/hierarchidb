import { Fragment, useRef } from 'react';
import { MultiStepDialogProvider } from '../hooks/useMultiStepDialogContext.js';
import type {
  HeadlessFooterRenderProps,
  HeadlessHeaderRenderProps,
  HeadlessMultiStepDialogProps,
  HeadlessMultiStepDialogContextValue,
} from './types.js';
import { MultiStepDialogHeader } from './MultiStepDialogHeader.js';
import { MultiStepDialogContent } from './MultiStepDialogContent.js';
import { MultiStepDialogFooter } from './MultiStepDialogFooter.js';

function asReadonlyArray(source?: ReadonlyArray<number>): ReadonlyArray<number> {
  return source ?? [];
}

function asReadonlyMap(source?: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return source ?? {};
}

/**
 * Headless MultiStepDialog container. Renders provided header/content/footer
 * components inside a context provider so that each layer can access dialog
 * state and callbacks.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shallowEqualData(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  const stack: Array<{ left: unknown; right: unknown }> = [{ left: a, right: b }];
  while (stack.length) {
    const { left, right } = stack.pop()!;
    if (left === right) continue;
    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    if (leftIsArray || rightIsArray) {
      if (!leftIsArray || !rightIsArray) return false;
      const l = left as unknown[];
      const r = right as unknown[];
      if (l.length !== r.length) return false;
      for (let i = 0; i < l.length; i += 1) {
        stack.push({ left: l[i], right: r[i] });
      }
      continue;
    }
    const leftIsObj = isPlainObject(left);
    const rightIsObj = isPlainObject(right);
    if (leftIsObj || rightIsObj) {
      if (!leftIsObj || !rightIsObj) return false;
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
        stack.push({
          left: (left as Record<string, unknown>)[key],
          right: (right as Record<string, unknown>)[key],
        });
      }
      continue;
    }
    if (left !== right) return false;
  }
  return true;
}

export function HeadlessMultiStepDialog<TData>(props: HeadlessMultiStepDialogProps<TData>) {
  const {
    open,
    stepComponents,
    stepData,
    onStepDataChange,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap,
    isDirty = false,
    onStepNavigate,
    onRequestClose,
    onRequestCommit,
    HeaderComponent = MultiStepDialogHeader,
    ContentComponent = MultiStepDialogContent,
    FooterComponent = MultiStepDialogFooter,
    renderHeader,
    renderFooter,
    ...frameProps
  } = props;

  const contextRef = useRef<HeadlessMultiStepDialogContextValue<TData> | null>(null);

  const nextValue: HeadlessMultiStepDialogContextValue<TData> = {
    open,
    stepComponents,
    stepData,
    onStepDataChange,
    activeStepIndex,
    enabledStepIndices: asReadonlyArray(enabledStepIndices),
    validatedStepIndices: asReadonlyArray(validatedStepIndices),
    committableStepIndices: asReadonlyArray(committableStepIndices),
    invalidMessageMap: asReadonlyMap(invalidMessageMap),
    isDirty,
    onStepNavigate,
    onRequestClose,
    onRequestCommit,
    ...frameProps,
  };

  const prev = contextRef.current;
  const debugCounterRef = useRef(0);

  const diffReason = (() => {
    if (!prev) return 'no-prev';
    if (prev.open !== nextValue.open) return 'open';
    if (prev.activeStepIndex !== nextValue.activeStepIndex) return 'activeStepIndex';
    if (prev.onStepDataChange !== nextValue.onStepDataChange) return 'onStepDataChange';
    if (prev.onStepNavigate !== nextValue.onStepNavigate) return 'onStepNavigate';
    if (prev.onRequestClose !== nextValue.onRequestClose) return 'onRequestClose';
    if (prev.onRequestCommit !== nextValue.onRequestCommit) return 'onRequestCommit';
    if (!shallowEqualData(prev.stepData, nextValue.stepData)) return 'stepData';
    if (!shallowEqualData(prev.stepComponents, nextValue.stepComponents)) return 'stepComponents';
    if (!shallowEqualData(prev.enabledStepIndices, nextValue.enabledStepIndices))
      return 'enabledStepIndices';
    if (!shallowEqualData(prev.validatedStepIndices, nextValue.validatedStepIndices))
      return 'validatedStepIndices';
    if (!shallowEqualData(prev.committableStepIndices, nextValue.committableStepIndices))
      return 'committableStepIndices';
    if (!shallowEqualData(prev.invalidMessageMap, nextValue.invalidMessageMap))
      return 'invalidMessageMap';
    if (prev.isDirty !== nextValue.isDirty) return 'isDirty';
    if (!shallowEqualData(prev.position, nextValue.position)) return 'position';
    if (!shallowEqualData(prev.size, nextValue.size)) return 'size';
    if (prev.displayMode !== nextValue.displayMode) return 'displayMode';
    if (prev.headerDisplayMode !== nextValue.headerDisplayMode) return 'headerDisplayMode';
    if (prev.footerDisplayMode !== nextValue.footerDisplayMode) return 'footerDisplayMode';
    if (prev.headerHoverZoneHeight !== nextValue.headerHoverZoneHeight)
      return 'headerHoverZoneHeight';
    if (prev.footerHoverZoneHeight !== nextValue.footerHoverZoneHeight)
      return 'footerHoverZoneHeight';
    return null;
  })();

  const shouldReuse = prev && diffReason === null;

  if (!shouldReuse && prev && debugCounterRef.current < 50 && typeof console !== 'undefined') {
    debugCounterRef.current += 1;
    console.debug('[HeadlessMultiStepDialog] context diff', diffReason);
  }

  const contextValue = shouldReuse ? prev! : (contextRef.current = nextValue);

  const headerElement = (
    <HeaderComponent>
      {renderHeader as ((props: HeadlessHeaderRenderProps<TData>) => React.ReactNode) | undefined}
    </HeaderComponent>
  );
  const contentElement = (
    <ContentComponent />
  );
  const footerElement = (
    <FooterComponent>
      {renderFooter as ((props: HeadlessFooterRenderProps<TData>) => React.ReactNode) | undefined}
    </FooterComponent>
  );

  return (
    <MultiStepDialogProvider value={contextValue}>
      <Fragment>{headerElement}</Fragment>
      <Fragment>{contentElement}</Fragment>
      <Fragment>{footerElement}</Fragment>
    </MultiStepDialogProvider>
  );
}
