// Export step components for potential reuse
export { ResolverDialog } from './ResolverDialog.js';
export type { ResolverDialogProps } from './ResolverDialog.js';
export { ResolverPanel } from './ResolverPanel.js';

// Export step components for potential reuse
export { ResolverBasicInfoStep } from './steps/ResolverBasicInfoStep.js';
export { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
export { PropertyMappingStep } from './steps/PropertyMappingStep.js';
export { ValidationConfigStep } from './steps/ValidationConfigStep.js';
export { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
export { PreviewTestStep } from './steps/PreviewTestStep.js';

export async function loadResolverDialogModule() {
  return import(/* @vite-ignore */ './ResolverDialog.js');
}

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './ResolverPanel.js');
}

export async function loadResolverBasicInfoStepModule() {
  return import(/* @vite-ignore */ './steps/ResolverBasicInfoStep.js');
}

export async function loadSchemaSelectionStepModule() {
  return import(/* @vite-ignore */ './steps/SchemaSelectionStep.js');
}

export async function loadPropertyMappingStepModule() {
  return import(/* @vite-ignore */ './steps/PropertyMappingStep.js');
}

export async function loadValidationConfigStepModule() {
  return import(/* @vite-ignore */ './steps/ValidationConfigStep.js');
}

export async function loadDuplicateResolutionStepModule() {
  return import(/* @vite-ignore */ './steps/DuplicateResolutionStep.js');
}

export async function loadPreviewTestStepModule() {
  return import(/* @vite-ignore */ './steps/PreviewTestStep.js');
}
