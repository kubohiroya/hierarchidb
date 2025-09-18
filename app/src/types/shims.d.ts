// Minimal type shims for packages that don't have proper exports
// Most types are now imported from actual packages


// legacy virtual:plugin-map removed; use virtual:plugin-registry-*

//  Removed: UI and worker package shims replaced by real package types

// Provide minimal types for runtime-worker-bootstrap if TS cannot resolve declarations
declare module '@hierarchidb/runtime-worker-bootstrap' {
  export type WorkerInitMessageType =
    | 'INIT_REQUEST'
    | 'INIT_COMPLETE'
    | 'INIT_ERROR'
    | 'INIT_PROGRESS'
    | 'PING'
    | 'PING_RESPONSE';

  export interface WorkerInitConfig {
    worker: Worker;
    timeout?: number;
    debug?: boolean;
  }

  export interface InitializationResult {
    success: boolean;
    duration?: number;
    error?: Error;
  }

  export interface InitializationStep {
    name: string;
    weight: number;
  }

  export class WorkerInitializationReporter {
    constructor(steps?: InitializationStep[], debug?: boolean);

    reportStepProgress(message: string, progress: number): void;

    reportComplete(): void;

    reportError(message: string): void;
  }

  export class WorkerInitializationChannel {
    constructor();

    waitForInitialization(config: WorkerInitConfig): Promise<InitializationResult>;

    ping(): Promise<boolean>;

    dispose(): void;
  }
}

// Minimal type facades to unblock app typecheck (remove when upstream types are stable)
declare module '@hierarchidb/common-type' {
  export type NodeId = string;
  export type TreeId = string;
  export type TagId = string;
  export type NodeType = string;
  export interface Tree { id: TreeId; name: string; rootId?: string; trashRootId?: string }
  export interface TreeNode { id: NodeId; name: string; nodeType: string; description?: string; parentId?: NodeId | null; depth?: number; createdAt?: number; updatedAt?: number; version?: number }
  export type SubscriptionId = string & { readonly __brand: 'SubscriptionId' };
  export interface PluginDefinition { nodeType: string; name?: string; version?: string }
  export interface TagEntity { id: string; name: string; color?: string; category?: string; description?: string; usageCount?: number; createdAt?: number; updatedAt?: number }
  export interface NodeTagAssociation { id: string; nodeId: NodeId; tagId: TagId; assignedAt?: number; createdAt?: number; updatedAt?: number }
  export interface NodeAction { id: string; label: string }
  // Backfill a few legacy/common utility types referenced by plugins
  export type BaseEntity = { id: string; createdAt?: number; updatedAt?: number };
  export type Timestamp = number;
  export interface ProgressEvent { progress?: number; percentage?: number; message?: string; total?: number; completed?: number; failed?: number; stage?: string; currentTask?: string; sessionId?: string; timestamp?: number }
  // Common menu types used by app bridge
  export type CreateMenuEntry = {
    key: string;
    nodeType: string;
    label: string;
    icon?: { muiIconName?: string; emoji?: string; color?: string };
  };
  export type CreateMenuBuilder = (arg?: string) => CreateMenuEntry[];
}
declare module '@hierarchidb/util' {
  export function getDBName(...args: any[]): string;
}

// Minimal shims for UI packages when dist-only type resolution is enforced
declare module '@hierarchidb/ui-icon' {
  export function getMuiIconComponent(name?: string, emoji?: string): any;
  export function getMuiIconWithColor(name?: string, emoji?: string, color?: string): any;
  export function setGlobalMuiIconMap(map: Record<string, any>): void;
  export function prefetchMuiIcons(names: Array<string | undefined | null>): Promise<void>;
}

declare module '@hierarchidb/ui-treeconsole-breadcrumb' {
  export const NodeTypeIcon: any;
  export const TreeConsoleBreadcrumb: any;
  export type BreadcrumbNode = any;
}

// Minimal shim for base TreeConsole components and types
declare module '@hierarchidb/ui-treeconsole-base' {
  export interface TreeNodeData {
    id: string;
    name: string;
    nodeType: string;
    description?: string;
    createdAt?: number;
    updatedAt?: number;
    hasChildren?: boolean;
    [key: string]: any;
  }
  export interface TreeTableColumn<T = TreeNodeData> {
    id: string;
    label: string;
    width?: number;
    sortable?: boolean;
    render?: (value: unknown, node: T) => any;
  }
  export interface TreeConsolePanelProps {
    [key: string]: any;
  }
  export const TreeConsolePanel: any;
}

// Virtual modules now have generated d.ts under app/.generated/types
declare module 'virtual:plugin-definitions' {
  const defs: any[];
  export default defs;
}

declare module 'virtual:mui-icon-map' {
  const iconMap: Record<string, any>;
  export default iconMap;
}

declare module 'virtual:plugin-registry-services' {
  const services: any;
  export default services;
}

declare module 'virtual:plugin-registry-worker' {
  const workerEntrypoints: any;
  export default workerEntrypoints;
}

// FEATURE FLAGS (ambient)
declare global {
  interface FeatureFlags {
    SUBSCRIPTION_BATCH_MS?: number | string;
    UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE?: boolean | string | number;
  }
  // eslint-disable-next-line no-var
  var FEATURE_FLAGS: FeatureFlags | undefined;
}

// Minimal shim for folder-plugin top-level helper used at app bootstrap
declare module '@hierarchidb/folder-plugin' {
  export function initializeDefaultNodeDialogExtensions(): Promise<void>;
}

declare module '@hierarchidb/ui-theme' {
  export type ThemeMode = 'light' | 'dark' | 'system';
  export function createAppTheme(mode: any): any;
  export function useThemeMode(): { actualTheme: any; setMode: (m: ThemeMode) => void };
  export function getStoredThemeMode(): ThemeMode | null;
  export const ThemeProvider: any;
}

// Minimal shim for ui-treeconsole-toolbar until full d.ts is available
declare module '@hierarchidb/ui-treeconsole-toolbar' {
  export type TreeConsoleToolbarActionParams = any;
  export const TreeConsoleToolbar: any;
}

// Minimal shim for ui-auth until full d.ts is available
declare module '@hierarchidb/ui-auth' {
  export const SimpleBFFAuthProvider: any;
  export function useSimpleBFFAuth(): any;
  export function useAuth(): any;
  export const BFFAuthService: any;
  export const LoginForm: any;
}

// Exports subpath shim for TS4.x (remove after TS5 migration or when nodenext is adopted)
declare module '@hierarchidb/resolver-plugin/database' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/spreadsheet-plugin/database' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/route-plugin/database' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/shape-plugin/services' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/location-plugin/services' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/styler-plugin/services' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/timeline-plugin/services' {
  const mod: any;
  export = mod;
}
declare module '@hierarchidb/linker-plugin/services' {
  const mod: any;
  export = mod;
}
