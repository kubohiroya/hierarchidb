/**
 * @file ui-core/index.ts
 * @description Core UI components with tree/database dependencies
 */

// Domain components moved from ui package
// export * from './components/misc-ui';

// Basic components that work independently
export { InlineIcon } from './components/InlineIcon/InlineIcon';
export { BackActionButton } from './components/BackActionButton/BackActionButton';
export { CloseActionButton } from './components/CloseActionButton/CloseActionButton';

// Re-export theme utilities from ui-theme
// Temporarily disabled until ui-theme package is properly configured
// export {
//   createAppTheme,
//   defaultTheme as theme,
//   ThemeProvider,
//   useThemeMode,
//   getThemeIcon,
//   getThemeDisplayName,
//   type ThemeMode,
//   type ThemeContextType,
// } from '@hierarchidb/ui-theme';

// Toast components temporarily disabled due to dependency issues:
// export { ToastProvider, useToast } from './components/toast';

// Additional components
export { AriaLiveRegion } from './components/AriaLiveRegion/AriaLiveRegion';

// Info components
export {
  InfoDialog,
  InfoContent,
  InfoPanel,
  LicenseInfo,
  type InfoDialogProps,
  type InfoContentProps,
  type InfoPanelProps,
  type InfoPanelAction,
  type LicenseInfoProps,
  type LicenseData,
  type LicenseRecord,
} from './components/Info';

// Components that are now working after fixes
export { ResourceProjectPreviewGroup } from './components/ResourceProjectPreviewGroup';
export { ResourceProjectToggle } from './components/ResourceProjectToggle';
export {
  TreeToggleButtonGroup,
  createResourcesTreeConfig,
  createProjectsTreeConfig,
  type TreeConfig,
  type TreeToggleButtonGroupProps,
} from './components/TreeToggleButtonGroup';
