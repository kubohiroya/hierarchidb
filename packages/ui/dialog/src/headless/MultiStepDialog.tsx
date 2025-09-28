import { Fragment } from 'react';
import { MultiStepDialogProvider } from './context.js';
import type {
  HeadlessContentRenderProps,
  HeadlessFooterRenderProps,
  HeadlessHeaderRenderProps,
  HeadlessMultiStepDialogProps,
  HeadlessMultiStepDialogContextValue,
} from './types.js';
import { MultiStepDialogHeader } from './MultiStepDialogHeader.js';
import { MultiDialogContent } from './MultiDialogContent.js';
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
    ContentComponent = MultiDialogContent,
    FooterComponent = MultiStepDialogFooter,
    renderHeader,
    renderContent,
    renderFooter,
    ...frameProps
  } = props;

  const contextValue: HeadlessMultiStepDialogContextValue<TData> = {
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

  const headerElement = (
    <HeaderComponent>
      {renderHeader as ((props: HeadlessHeaderRenderProps<TData>) => React.ReactNode) | undefined}
    </HeaderComponent>
  );
  const contentElement = (
    <ContentComponent>
      {renderContent as ((props: HeadlessContentRenderProps<TData>) => React.ReactNode) | undefined}
    </ContentComponent>
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

export default HeadlessMultiStepDialog;
