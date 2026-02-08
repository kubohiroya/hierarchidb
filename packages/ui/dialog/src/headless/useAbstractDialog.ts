import { useRef } from 'react';
import type { ComponentType } from 'react';
import { PluginDialogHeader } from './PluginDialogHeader.js';
import { PluginDialogContent } from './PluginDialogContent.js';
import { PluginDialogFooter } from './PluginDialogFooter.js';
import type {
  AbstractDialogContentProps,
  AbstractDialogFooterProps,
  AbstractDialogHeaderProps,
} from './AbstractDialogElements.js';
import type {
  HeadlessDialogContextValue,
  HeadlessDialogContentProps,
  HeadlessDialogFooterProps,
  HeadlessDialogHeaderProps,
  HeadlessDialogProps,
} from './types.js';

function asReadonlyArray(source?: ReadonlyArray<number>): ReadonlyArray<number> {
  return source ?? [];
}

function asReadonlyMap(source?: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return source ?? {};
}

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

export type AbstractDialogState<TData> = {
  contextValue: HeadlessDialogContextValue<TData>;
  headerProps: AbstractDialogHeaderProps<TData>;
  contentProps: AbstractDialogContentProps<TData>;
  footerProps: AbstractDialogFooterProps<TData>;
};

export function useAbstractDialog<TData>(
  props: HeadlessDialogProps<TData>
): AbstractDialogState<TData> {
  const contextRef = useRef<HeadlessDialogContextValue<TData> | null>(null);

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
    HeaderComponent: HeaderComponentProp,
    ContentComponent: ContentComponentProp,
    FooterComponent: FooterComponentProp,
    renderHeader,
    renderFooter,
    ...frameProps
  } = props;
  const HeaderComponent =
    HeaderComponentProp ??
    (PluginDialogHeader as ComponentType<HeadlessDialogHeaderProps<TData>>);
  const ContentComponent =
    ContentComponentProp ??
    (PluginDialogContent as ComponentType<HeadlessDialogContentProps<TData>>);
  const FooterComponent =
    FooterComponentProp ??
    (PluginDialogFooter as ComponentType<HeadlessDialogFooterProps<TData>>);

  const nextValue: HeadlessDialogContextValue<TData> = {
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

  const diffReason = (() => {
    if (!prev) return 'no-prev';
    if (prev.open !== nextValue.open) return 'open';
    if (prev.activeStepIndex !== nextValue.activeStepIndex) return 'activeStepIndex';
    if (prev.onStepDataChange !== nextValue.onStepDataChange) return 'onStepDataChange';
    if (!shallowEqualData(prev.stepData, nextValue.stepData)) return 'stepData';
    if (prev.onStepNavigate !== nextValue.onStepNavigate) return 'onStepNavigate';
    if (prev.onRequestClose !== nextValue.onRequestClose) return 'onRequestClose';
    if (prev.onRequestCommit !== nextValue.onRequestCommit) return 'onRequestCommit';
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
    if (prev.isMinimized !== nextValue.isMinimized) return 'isMinimized';
    if (prev.onMinimizeChange !== nextValue.onMinimizeChange) return 'onMinimizeChange';
    return null;
  })();

  const shouldReuse = prev && diffReason === null;
  const contextValue = shouldReuse && prev ? prev : nextValue;
  if (!shouldReuse) {
    contextRef.current = nextValue;
  }

  const headerProps: AbstractDialogHeaderProps<TData> = {
    HeaderComponent,
    headerRenderer: renderHeader,
  };
  const contentProps: AbstractDialogContentProps<TData> = {
    ContentComponent,
  };
  const footerProps: AbstractDialogFooterProps<TData> = {
    FooterComponent,
    footerRenderer: renderFooter,
  };

  return { contextValue, headerProps, contentProps, footerProps };
}

