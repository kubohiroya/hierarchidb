/**
  * Plugin System Types for TreeTable
  * TreeTable
   */

import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import type { CellContext } from '@tanstack/react-table';
import type { TreeNodeInUI } from '../types.js';

// =============================================================================
// Core Plugin Interfaces
// =============================================================================

/**
  * TreeTable
  */
export interface TreeTablePlugin {
  /**
      */
  name: string;
  /**
      */
  version: string;
  /**
      */
  hooks: TreeTableHooks;
  /**
      */
  components?: TreeTableComponentOverrides;
  /**
      */
  dependencies?: string[];
  /**
      */
  config?: Record<string, unknown>;
}

/**
  * TreeTable
  */
export interface TreeTableHooks {
  // Cell rendering extensions
  onBeforeCellRender?: (
    cell: CellContext<TreeNodeInUI, unknown>,
  ) => CellContext<TreeNodeInUI, unknown>;
  onAfterCellRender?: (
    element: ReactElement,
    cell: CellContext<TreeNodeInUI, unknown>,
  ) => ReactElement;

  // Row interaction extensions
  onRowClick?: (node: TreeNodeInUI, event: MouseEvent) => boolean | undefined;
  onRowDoubleClick?: (node: TreeNodeInUI, event: MouseEvent) => boolean | undefined;
  onRowContextMenu?: (node: TreeNodeInUI, event: MouseEvent) => boolean | undefined;
  onKeyDown?: (event: KeyboardEvent, context: KeyboardContext) => boolean | undefined;

  // State change extensions
  onEditingStateChange?: (editingNodeId: string | null) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onExpansionChange?: (expandedIds: string[]) => void;

  // Data manipulation extensions
  onBeforeNodeUpdate?: (nodeId: string, newData: Partial<TreeNodeInUI>) => Promise<boolean>;
  onAfterNodeUpdate?: (nodeId: string, newData: Partial<TreeNodeInUI>) => Promise<void>;

  // Toolbar extensions
  onToolbarRender?: (
    toolbar: ToolbarContext,
    context: TreeTableContext,
  ) => Promise<{ toolbar: ToolbarContext; context: TreeTableContext }>;

  // Context menu extensions
  onContextMenu?: (
    node: TreeNodeInUI,
    event: MouseEvent,
    context: TreeTableContext,
  ) => Promise<void>;

  // Plugin lifecycle
  onPluginInit?: () => void | Promise<void>;
  onPluginDestroy?: () => void | Promise<void>;
}

/**
    */
export interface TreeTableComponentOverrides {
  CellEditor?: React.ComponentType<CellEditorProps>;
  RowDecorator?: React.ComponentType<RowDecoratorProps>;
  ColumnHeader?: React.ComponentType<ColumnHeaderProps>;
  LoadingIndicator?: React.ComponentType<LoadingIndicatorProps>;
  ErrorBoundary?: React.ComponentType<ErrorBoundaryProps>;
  ToolbarActions?: React.ComponentType<ToolbarActionsProps>;
  ContextMenuItems?: React.ComponentType<ContextMenuItemsProps>;
}

// =============================================================================
// Component Props Interfaces
// =============================================================================

export interface CellEditorProps {
  node: TreeNodeInUI;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  onCancel: () => void;
  validationErrors?: string[];
  isLoading?: boolean;
}

export interface RowDecoratorProps {
  node: TreeNodeInUI;
  isSelected: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  children: React.ReactNode;
}

export interface ColumnHeaderProps {
  column: {
    id: string;
    header: string;
    canSort?: boolean;
    isSorted?: boolean;
    sortDirection?: 'asc' | 'desc';
  };
  onSort?: (direction: 'asc' | 'desc') => void;
}

export interface LoadingIndicatorProps {
  isLoading: boolean;
  message?: string;
}

export interface ErrorBoundaryProps {
  error?: Error;
  onRetry?: () => void;
  children: React.ReactNode;
}

export interface ToolbarActionsProps {
  context: TreeTableContext;
}

export interface ContextMenuItemsProps {
  node: TreeNodeInUI;
  context: TreeTableContext;
}

// =============================================================================
// Context Interfaces
// =============================================================================

export interface KeyboardContext {
  selectedNodes: string[];
  expandedNodes: string[];
  editingNodeId: string | null;
  focusedCellId: string | null;
}

export interface TreeTableContext {
  selectedNodeIds?: Set<string>;
  expandedNodeIds?: Set<string>;
  currentNodeId?: string;
  permissions?: {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
  showNotification?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  contextMenuItems?: ContextMenuItem[];

  [key: string]: unknown; // Allow for plugin-specific context data
}

export interface ToolbarContext {
  title?: string;
  selectedCount: number;
  totalCount: number;
  additionalActions?: ToolbarAction[];
}

export interface ToolbarAction {
  component: React.ReactElement;
  position: 'start' | 'end' | 'before-more' | 'after-more';
  key: string;
}

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: string;
  type?: 'item' | 'divider' | 'submenu';
  onClick?: () => void;
  submenu?: ContextMenuItem[];
  disabled?: boolean;
  visible?: boolean;
}

export interface PluginContext {
  registry: PluginRegistry;
  executeHook: <T extends keyof TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<TreeTableHooks[T]>>
  ) => Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>>;
}

// =============================================================================
// Registry Interfaces
// =============================================================================

export interface PluginRegistry {
  register(plugin: TreeTablePlugin): void;

  unregister(pluginName: string): void;

  getPlugin(name: string): TreeTablePlugin | undefined;

  getPlugins(): TreeTablePlugin[];

  hasPlugin(name: string): boolean;

  executeHook<T extends keyof TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<TreeTableHooks[T]>>
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>>;
}

// =============================================================================
// Configuration Interfaces
// =============================================================================

export interface PluginConfig {
  /**
      */
  enabled: boolean;
  /**
      */
  settings?: Record<string, unknown>;
}

export interface TreeTablePluginConfig {
  /**
      */
  plugins: Record<string, PluginConfig>;
  /**
      */
  global?: {
    /**
          */
    loadOrder?: string[];
    /**
          */
    debug?: boolean;
  };
}

// =============================================================================
// Event Interfaces
// =============================================================================

export interface PluginEvent<TData = unknown> {
  type: string;
  plugin: string;
  timestamp: number;
  data?: TData;
}

export interface HookExecutionResult<T = unknown> {
  plugin: string;
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
    */
export type PluginLifecycleState =
  | 'unregistered'
  | 'registered'
  | 'initializing'
  | 'initialized'
  | 'error'
  | 'destroyed';

/**
    */
export type HookExecutionMode =
  | 'sequential' | 'parallel' | 'first-match' | 'accumulate';
/**
    */
export type PluginPriority = 'high' | 'normal' | 'low';

// =============================================================================
// Error Types
// =============================================================================

export class PluginError extends Error {
  constructor(
    message: string,
    public pluginName: string,
    public hookName?: string,
  ) {
    super(`[Plugin: ${pluginName}] ${message}`);
    this.name = 'PluginError';
  }
}

export class PluginRegistrationError extends PluginError {
  constructor(pluginName: string, reason: string) {
    super(`Failed to register plugin: ${reason}`, pluginName);
    this.name = 'PluginRegistrationError';
  }
}

export class HookExecutionError extends PluginError {
  constructor(pluginName: string, hookName: string, originalError: Error) {
    super(`Hook execution failed: ${originalError.message}`, pluginName, hookName);
    this.name = 'HookExecutionError';
  }
}
