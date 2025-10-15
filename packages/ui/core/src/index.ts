/*
// Plugin System Exports
export * from './plugins/index.js';
// Component Exports
export { ThemedLoadingScreen } from './components/ThemedLoadingScreen.js';
export { TreeToggleButtonGroup } from './components/TreeToggleButtonGroup/index.js';
export type { TreeConfig } from './components/TreeToggleButtonGroup/index.js';
export { BaseIcon, createSvgIcon, createMuiIconWrapper } from './components/BaseIcon.js';
export type { BaseIconProps, SvgIconDefinition } from './components/BaseIcon.js';
export { DropdownMenu } from './components/DropdownMenu/DropdownMenu.js';
export type { DropdownMenuItemType } from './components/DropdownMenu/DropdownMenuItemType.js';
export { TagInput } from './components/TagInput.js';
export { CategorySelector } from './components/CategorySelector.js';
export { BasicInfoFields } from './components/BasicInfoFields.js';
export type { BasicInfoFieldsProps, BasicInfoValue } from './components/BasicInfoFields.js';
export { TagChipsInput } from './components/TagChipsInput.js';
export type { TagChipsInputProps } from './components/TagChipsInput.js';
export { TabularPreview } from './components/TabularPreview/TabularPreview.js';
export { SparkleAnimation } from './components/sparkle-animation/SparkleAnimation.js';
export { CrossViewStyles } from './sync/CrossViewStyles.js';
export { CrossViewSnackbar } from './components/CrossViewSnackbar.js';
export { useCrossHighlightSync } from './hooks/useCrossHighlightSync.js';
export { useMapLibreFeatureState } from './hooks/useMapLibreFeatureState.js';
export { ensureDefaultStyles } from './utils/ensureDefaultStyles.js';

// Hook Exports
export { useAsyncOperation } from './hooks/useAsyncOperation.js';
export type { UseAsyncOperationResult } from './hooks/useAsyncOperation.js';
export { useFormState } from './hooks/useFormState.js';
export type { UseFormStateOptions, UseFormStateResult, FormFieldError } from './hooks/useFormState.js';
// Batch progress hooks (public API)
export { useBatchProgress } from './hooks/useBatchProgress.js';
export { createAdapterFromProgressSubscribe, progressEventToUnified } from './hooks/progressAdapters.js';
export type { UnifiedProgressInfo, BatchProgressAdapter, UseBatchProgressOptions } from './hooks/useBatchProgress.js';
*/
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
  getActualTheme,
} from './utils/theme.js';
export type { ThemeMode } from './utils/theme.js';


// Re-export EditDialogProps from plugin-loader (which is the main one used)
export type { EditDialogProps } from './plugins/index.js';


// Plugin host-facing component types
export type { PluginDialogComponent, PluginPanelComponent, PluginDialogProps, PluginPanelProps } from './types/plugin-exports.js';


// Misc types/utilities
export { rainbowColors } from './types/RainbowColors.js';
