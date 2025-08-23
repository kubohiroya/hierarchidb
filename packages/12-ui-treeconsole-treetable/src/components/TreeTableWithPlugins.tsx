/**
 * TreeTable with Plugin Support
 * 
 * 既存のTreeTableCoreを拡張し、プラグインシステムのサポートを追加。
 * 既存コードへの影響を最小化しながら、段階的に新機能を導入できます。
 */

import { 
  useMemo, 
  useCallback, 
  useState, 
  useEffect,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import { TreeTableCore } from './TreeTableCore';
import { PluginProvider, usePluginContext } from '../plugin/PluginProvider';
import type { TreeTableCoreProps, TreeNode } from '../types';
import type { TreeTablePlugin } from '../plugin/types';

// =============================================================================
// Enhanced Props Interface
// =============================================================================

export interface TreeTableWithPluginsProps extends TreeTableCoreProps {
  /**
   * プラグインの配列
   */
  plugins?: TreeTablePlugin[];
  
  /**
   * プラグインのデバッグモードを有効にする
   */
  debugPlugins?: boolean;
  
  /**
   * プラグインイベントのリスナー
   */
  onPluginEvent?: (event: any) => void;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * プラグインシステム対応のTreeTable
 */
export function TreeTableWithPlugins({
  plugins = [],
  debugPlugins = false,
  onPluginEvent,
  ...props
}: TreeTableWithPluginsProps) {
  return (
    <PluginProvider 
      plugins={plugins}
      debugMode={debugPlugins}
      onPluginEvent={onPluginEvent}
    >
      <PluginEnhancedTreeTable {...props} />
    </PluginProvider>
  );
}

// =============================================================================
// Plugin-Enhanced TreeTable Core
// =============================================================================

/**
 * プラグイン機能が統合されたTreeTableCoreの内部実装
 */
function PluginEnhancedTreeTable(props: TreeTableCoreProps) {
  const { executeHook } = usePluginContext();
  const [pluginState, setPluginState] = useState({
    editingNodeId: null as string | null,
    keyboardContext: {
      selectedNodes: [] as string[],
      expandedNodes: [] as string[],
      editingNodeId: null as string | null,
      focusedCellId: null as string | null,
    }
  });

  // Enhanced event handlers with plugin integration
  const enhancedHandlers = useMemo(() => {
    return {
      onRowClick: (node: TreeNode, event: MouseEvent) => {
        // プラグインフックを実行
        const results = executeHook('onRowClick', node, event);
        
        // プラグインが処理を行った場合（trueを返した場合）、デフォルト処理をスキップ
        const handled = results.some(result => result === true);
        if (!handled && props.onRowClick) {
          props.onRowClick(node, event);
        }
      },

      onRowDoubleClick: (node: TreeNode, event: MouseEvent) => {
        const results = executeHook('onRowDoubleClick', node, event);
        const handled = results.some(result => result === true);
        if (!handled && props.onRowDoubleClick) {
          props.onRowDoubleClick(node, event);
        }
      },

      onRowContextMenu: (node: TreeNode, event: MouseEvent) => {
        const results = executeHook('onRowContextMenu', node, event);
        const handled = results.some(result => result === true);
        if (!handled && props.onRowContextMenu) {
          props.onRowContextMenu(node, event);
        }
      },

      onKeyDown: (event: KeyboardEvent) => {
        const results = executeHook('onKeyDown', event, pluginState.keyboardContext);
        const handled = results.some(result => result === true);
        
        if (!handled) {
          // デフォルトのキーボード処理
          handleDefaultKeyDown(event);
        }
      },
    };
  }, [executeHook, props.onRowClick, props.onRowDoubleClick, props.onRowContextMenu, pluginState.keyboardContext]);

  // デフォルトのキーボード処理
  const handleDefaultKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'F2':
        // 編集開始
        const selectedNodeIds = props.controller?.rowSelection ? 
          Object.keys(props.controller.rowSelection).filter(id => props.controller?.rowSelection?.[id]) : [];
        if (selectedNodeIds.length === 1) {
          const nodeId = selectedNodeIds[0] || null;
          setPluginState(prev => ({ ...prev, editingNodeId: nodeId }));
          executeHook('onEditingStateChange', nodeId);
        }
        break;
        
      case 'Escape':
        // 編集キャンセル
        if (pluginState.editingNodeId) {
          setPluginState(prev => ({ ...prev, editingNodeId: null }));
          executeHook('onEditingStateChange', null);
        }
        break;
        
      default:
        // その他のキー処理
        break;
    }
  }, [props.controller, pluginState.editingNodeId, executeHook]);

  // プラグイン状態の更新
  useEffect(() => {
    const newKeyboardContext = {
      selectedNodes: props.controller?.rowSelection ? 
        Object.keys(props.controller.rowSelection).filter(id => props.controller?.rowSelection?.[id]) : [],
      expandedNodes: props.controller?.expandedRowIds ? 
        Array.from(props.controller.expandedRowIds) : [],
      editingNodeId: pluginState.editingNodeId,
      focusedCellId: null, // TODO: フォーカス管理の実装
    };

    setPluginState(prev => ({ ...prev, keyboardContext: newKeyboardContext }));
  }, [props.controller?.rowSelection, props.controller?.expandedRowIds, pluginState.editingNodeId]);

  // 編集状態の変更通知
  useEffect(() => {
    executeHook('onEditingStateChange', pluginState.editingNodeId);
  }, [pluginState.editingNodeId, executeHook]);

  // 選択状態の変更通知
  useEffect(() => {
    if (props.controller?.rowSelection) {
      const selectedIds = Object.keys(props.controller.rowSelection)
        .filter(id => props.controller?.rowSelection?.[id]);
      executeHook('onSelectionChange', selectedIds);
    }
  }, [props.controller?.rowSelection, executeHook]);

  // 展開状態の変更通知
  useEffect(() => {
    if (props.controller?.expandedRowIds) {
      const expandedIds = Array.from(props.controller.expandedRowIds);
      executeHook('onExpansionChange', expandedIds);
    }
  }, [props.controller?.expandedRowIds, executeHook]);

  // セル描画の拡張
  const enhancedRenderCell = useCallback((cellContext: any) => {
    // onBeforeCellRender フックを実行
    let modifiedContext = cellContext;
    const beforeResults = executeHook('onBeforeCellRender', cellContext);
    if (beforeResults.length > 0) {
      // 最後の結果を使用（複数のプラグインが変更を行った場合）
      modifiedContext = beforeResults[beforeResults.length - 1] || cellContext;
    }

    // デフォルトのセル描画
    let element = <DefaultCellRenderer cell={modifiedContext} />;

    // onAfterCellRender フックを実行
    const afterResults = executeHook('onAfterCellRender', element, modifiedContext);
    if (afterResults.length > 0) {
      // 最後の結果を使用
      element = afterResults[afterResults.length - 1] || element;
    }

    return element;
  }, [executeHook]);

  // プロップスを拡張
  const enhancedProps = useMemo(() => ({
    ...props,
    ...enhancedHandlers,
    // カスタムレンダラーの注入（将来の実装）
    cellRenderer: enhancedRenderCell,
  }), [props, enhancedHandlers, enhancedRenderCell]);

  // キーボードイベントのハンドリングを追加
  return (
    <div 
      onKeyDown={enhancedHandlers.onKeyDown}
      style={{ width: '100%', height: '100%' }}
      tabIndex={0} // キーボードイベントを受け取るため
    >
      <TreeTableCore {...enhancedProps} />
    </div>
  );
}

// =============================================================================
// Default Cell Renderer (Future Implementation)
// =============================================================================

function DefaultCellRenderer({ cell }: { cell: any }) {
  // 現在は基本的な実装
  // 将来的にはより詳細なセル描画ロジックを実装
  return <span>{cell.getValue?.() || ''}</span>;
}

// =============================================================================
// Feature-Specific Components
// =============================================================================

/**
 * インライン編集機能付きTreeTable
 */
export function InlineEditableTreeTable(props: TreeTableWithPluginsProps) {
  const defaultPlugins = useMemo(() => {
    // インライン編集に必要なプラグインを動的に読み込み
    // 実際の実装では、条件付きでプラグインを読み込む
    return props.plugins || [];
  }, [props.plugins]);

  return (
    <TreeTableWithPlugins
      {...props}
      plugins={defaultPlugins}
      enableInlineEditing={true}
    />
  );
}

/**
 * 高度なキーボードナビゲーション付きTreeTable
 */
export function KeyboardNavigableTreeTable(props: TreeTableWithPluginsProps) {
  const defaultPlugins = useMemo(() => {
    return props.plugins || [];
  }, [props.plugins]);

  return (
    <TreeTableWithPlugins
      {...props}
      plugins={defaultPlugins}
      enableAdvancedKeyboardNav={true}
    />
  );
}

/**
 * 全機能付きTreeTable
 */
export function AdvancedTreeTable(props: TreeTableWithPluginsProps) {
  const defaultPlugins = useMemo(() => {
    return props.plugins || [];
  }, [props.plugins]);

  return (
    <TreeTableWithPlugins
      {...props}
      plugins={defaultPlugins}
      enableInlineEditing={true}
      enableAdvancedKeyboardNav={true}
      enableDragDropEnhancements={true}
      enableSearchHighlight={true}
      enableWorkingCopyIntegration={true}
    />
  );
}

// =============================================================================
// Exports
// =============================================================================

export default TreeTableWithPlugins;