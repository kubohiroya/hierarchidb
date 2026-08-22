// Export step components for potential reuse
export { ResolverPanel } from './ResolverPanel.js';
export { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
export { PreviewTestStep } from './steps/PreviewTestStep.js';
export { PropertyMappingStep } from './steps/PropertyMappingStep.js';
export { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
export { ValidationConfigStep } from './steps/ValidationConfigStep.js';

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './ResolverPanel.js');
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
