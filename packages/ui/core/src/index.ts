// Plugin System Exports
export * from './plugins';

// Component Exports
export { ThemedLoadingScreen } from './components/ThemedLoadingScreen';
export { TreeToggleButtonGroup } from './components/TreeToggleButtonGroup';
export type { TreeConfig } from './components/TreeToggleButtonGroup';
export { BaseIcon, createSvgIcon, createMuiIconWrapper } from './components/BaseIcon';
export type { BaseIconProps, SvgIconDefinition } from './components/BaseIcon';
export { DropdownMenu } from './components/DropdownMenu/DropdownMenu';
export type { DropdownMenuItemType } from './components/DropdownMenu/DropdownMenuItemType';

// Hook Exports
export { useAsyncOperation } from './hooks/useAsyncOperation';
export type { UseAsyncOperationResult } from './hooks/useAsyncOperation';
export { useFormState } from './hooks/useFormState';
export type { UseFormStateOptions, UseFormStateResult, FormFieldError } from './hooks/useFormState';

// Utility Exports
// Logger now exported from @hierarchidb/common-core
export {
  getThemeIcon,
  getThemeDisplayName,
  getBackgroundColorForTheme,
  getTextColorForTheme,
  getThemeBackgroundColor,
  getThemeTextColor,
  getStoredThemeMode,
  getSystemTheme,
  getActualTheme
} from './utils/theme';
export type { ThemeMode } from './utils/theme';

// Type Exports (explicitly import to avoid conflicts with plugin types)
export type { 
  BaseDialogProps,
  NodeDialogProps,
  ConfirmDialogProps,
  BaseFormData,
  DialogResult,
  EditDialogProps as BaseEditDialogProps
} from './types/dialog';

// Re-export EditDialogProps from plugins (which is the main one used)
export type { EditDialogProps } from './plugins';

