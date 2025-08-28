/**
 * @fileoverview UI Dialog package exports
 *
 * This package provides generic, reusable dialog components.
 * Plugin-specific components are located in @hierarchidb/runtime-plugin-dialog
 */

// Generic dialog components

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy';
export { useDialogContext, DialogProvider } from './hooks/useDialogContext';

// Providers
export { NotificationProvider } from './providers/NotificationProvider';

// Types
export * from './components';
