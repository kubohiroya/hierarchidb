/**
 * Plugin System Types for TreeTable
 * 
 * このファイルはTreeTableのプラグインシステムで使用される
 * 基本的な型定義を提供します。
 */

import type { ReactElement, MouseEvent, KeyboardEvent } from 'react';
import type { CellContext } from '@tanstack/react-table';
import type { TreeNode } from '../types';

// =============================================================================
// Core Plugin Interfaces
// =============================================================================

/**
 * TreeTableプラグインの基本インターフェース
 */
export interface TreeTablePlugin {
  /** プラグインの一意な名前 */
  name: string;
  /** プラグインのバージョン */
  version: string;
  /** プラグインが提供するフック関数 */
  hooks: TreeTableHooks;
  /** プラグインが提供するコンポーネントのオーバーライド */
  components?: TreeTableComponentOverrides;
  /** プラグインの依存関係 */
  dependencies?: string[];
  /** プラグインの設定 */
  config?: Record<string, any>;
}

/**
 * TreeTableで使用可能なライフサイクルフック
 */
export interface TreeTableHooks {
  // Cell rendering extensions
  onBeforeCellRender?: (cell: CellContext<TreeNode, unknown>) => CellContext<TreeNode, unknown>;
  onAfterCellRender?: (element: ReactElement, cell: CellContext<TreeNode, unknown>) => ReactElement;
  
  // Row interaction extensions
  onRowClick?: (node: TreeNode, event: MouseEvent) => boolean | void;
  onRowDoubleClick?: (node: TreeNode, event: MouseEvent) => boolean | void;
  onRowContextMenu?: (node: TreeNode, event: MouseEvent) => boolean | void;
  onKeyDown?: (event: KeyboardEvent, context: KeyboardContext) => boolean | void;
  
  // State change extensions
  onEditingStateChange?: (editingNodeId: string | null) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onExpansionChange?: (expandedIds: string[]) => void;
  
  // Data manipulation extensions
  onBeforeNodeUpdate?: (nodeId: string, newData: Partial<TreeNode>) => Promise<boolean>;
  onAfterNodeUpdate?: (nodeId: string, newData: Partial<TreeNode>) => Promise<void>;
  
  // Toolbar extensions
  onToolbarRender?: (toolbar: ToolbarContext, context: TreeTableContext) => Promise<{ toolbar: ToolbarContext; context: TreeTableContext }>;
  
  // Context menu extensions
  onContextMenu?: (node: TreeNode, event: MouseEvent, context: TreeTableContext) => Promise<void>;
  
  // Plugin lifecycle
  onPluginInit?: () => void | Promise<void>;
  onPluginDestroy?: () => void | Promise<void>;
}

/**
 * プラグインが提供できるコンポーネントのオーバーライド
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
  node: TreeNode;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  onCancel: () => void;
  validationErrors?: string[];
  isLoading?: boolean;
}

export interface RowDecoratorProps {
  node: TreeNode;
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
  node: TreeNode;
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
  [key: string]: any; // Allow for plugin-specific context data
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
  ) => any[];
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
  ): any[];
}

// =============================================================================
// Configuration Interfaces
// =============================================================================

export interface PluginConfig {
  /** プラグインを有効にするかどうか */
  enabled: boolean;
  /** プラグイン固有の設定 */
  settings?: Record<string, any>;
}

export interface TreeTablePluginConfig {
  /** 各プラグインの設定 */
  plugins: Record<string, PluginConfig>;
  /** グローバル設定 */
  global?: {
    /** プラグインの読み込み順序を制御 */
    loadOrder?: string[];
    /** デバッグモードを有効にする */
    debug?: boolean;
  };
}

// =============================================================================
// Event Interfaces
// =============================================================================

export interface PluginEvent {
  type: string;
  plugin: string;
  timestamp: number;
  data?: any;
}

export interface HookExecutionResult<T = any> {
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
 * プラグインのライフサイクル状態
 */
export type PluginLifecycleState = 
  | 'unregistered'
  | 'registered' 
  | 'initializing'
  | 'initialized'
  | 'error'
  | 'destroyed';

/**
 * フックの実行モード
 */
export type HookExecutionMode = 
  | 'sequential'    // 順次実行
  | 'parallel'      // 並列実行
  | 'first-match'   // 最初の結果のみ使用
  | 'accumulate';   // 結果を蓄積

/**
 * プラグインの優先度
 */
export type PluginPriority = 'high' | 'normal' | 'low';

// =============================================================================
// Error Types
// =============================================================================

export class PluginError extends Error {
  constructor(
    message: string,
    public pluginName: string,
    public hookName?: string
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
  constructor(
    pluginName: string, 
    hookName: string, 
    originalError: Error
  ) {
    super(`Hook execution failed: ${originalError.message}`, pluginName, hookName);
    this.name = 'HookExecutionError';
  }
}