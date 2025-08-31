/**
 * @packageDocumentation
 * Runtime plugin base-dialog components for HierarchiDB
 *
 * This package provides base-dialog components specifically designed for
 * plugin runtime operations, including creation, editing, and management
 * of plugin-based entities.
 */
export function dummy() {}
/**
 * Runtime Plugin Dialog
 * Provides plugin dialog system with React Router integration
 */

// Registry
export { PluginStepRegistry } from './registry/PluginStepRegistry';
export type { 
  PluginStepProvider,
  PluginStepConfig,
  StepComponentProps,
} from './registry/PluginStepRegistry';

// Components
export { PluginDialog } from './components/PluginDialog';
export type { PluginDialogProps } from './components/PluginDialog';

export { PluginDialogRoute, createPluginDialogRoutes } from './components/PluginDialogRoute';

export { BasicInfoStep } from './components/steps/BasicInfoStep';
export type { BasicInfoStepProps, BasicInfoData } from './components/steps/BasicInfoStep';

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy';
export type { 
  UseWorkingCopyOptions,
  UseWorkingCopyResult,
  WorkingCopyData,
} from './hooks/useWorkingCopy';