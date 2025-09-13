// Ambient UI type declarations shared across packages
// Centralizing these avoids per-package local shims that dep-fence flags.

// CSS Modules (e.g., *.module.css)
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// MapLibre CSS import module
declare module 'maplibre-gl/dist/maplibre-gl.css';

// HierarchiDB UI icon resolver (runtime package provides real types)
declare module '@hierarchidb/ui-icon' {
  export function getMuiIconWithColor(
    muiIconName?: string,
    emoji?: string,
    color?: string,
  ): any;
}

// Minimal surface from runtime-worker-bootstrap used by UI packages
declare module '@hierarchidb/runtime-worker-bootstrap' {
  export type WorkerClientHook<T = any> = () => T;
  export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null;
}

// Data grid public surface used in types-only positions
declare module '@hierarchidb/ui-data-grid' {
  export const GenericDataGrid: any;
}

// Convenience rainbow colors export when types are not available (build-only)
declare module '@hierarchidb/ui-core' {
  export const rainbowColors: readonly string[];
  // Minimal surface to satisfy consumers without deep imports
  export const notify: any;
  export function useWorkingCopy<T = any>(opts: any): any;
  export function createAdapterFromProgressSubscribe(subscribe: (cb: (p: any) => void) => () => void): any;
  export function useBatchProgress(adapter: any, options?: any): { progress: any };
  export type PluginDialogComponent = any;
  export type PluginPanelComponent = any;
  // Commonly used form components
  export const BasicInfoFields: any;
  export const CategorySelector: any;
  export const TagInput: any;
  export const TagChipsInput: any;
  export const TabularPreview: any;
  // Cross-view sync utilities (map/table highlight)
  export const CrossViewSnackbar: any;
  export function useCrossHighlightSync(opts: any): any;
  export function useMapLibreFeatureState(opts: any): void;
  export function ensureDefaultStyles(datasetId: string, opts?: any): void;
  // Theme helpers
  export function getThemeDisplayName(mode: any): string;
  export function getThemeIcon(mode: any): any;
  // App-level helpers/components used in host app
  export const NotificationSystem: any;
  export function registerAllUIPlugins(): void;
  export type TreeConfig = any;
  export const TreeToggleButtonGroup: any;
  export function getUIPluginRegistry(): any;
  export const DropdownMenu: any;
}

// Lightweight theme module types to break build cycles
declare module '@hierarchidb/ui-theme' {
  export type ThemeMode = 'light' | 'dark' | 'system';
  export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void };
}
