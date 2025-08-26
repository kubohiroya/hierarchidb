/**
 * Inline Edit Plugin
 * 
 * TreeTableにインライン編集機能を追加するプラグイン
 */

import type { TreeTablePlugin } from '../plugin/types';
import type { TreeNodeInUI } from '../types';
import { KeyboardEvent } from 'react';

/**
 * インライン編集プラグインの設定
 */
export interface InlineEditPluginConfig {
  /**
   * 編集モードの開始キー（デフォルト: F2）
   */
  editStartKey?: string;
  
  /**
   * 編集の確定キー（デフォルト: Enter）
   */
  confirmKey?: string;
  
  /**
   * 編集のキャンセルキー（デフォルト: Escape）
   */
  cancelKey?: string;
  
  /**
   * ダブルクリックで編集モード開始するか（デフォルト: true）
   */
  enableDoubleClickEdit?: boolean;
  
  /**
   * 編集前の検証関数
   */
  validateBeforeEdit?: (node: TreeNodeInUI) => boolean | Promise<boolean>;
  
  /**
   * 保存前の検証関数
   */
  validateBeforeSave?: (node: TreeNodeInUI, newValue: string) => boolean | Promise<boolean>;
}

/**
 * インライン編集プラグインを作成
 */
export function createInlineEditPlugin(config?: InlineEditPluginConfig): TreeTablePlugin {
  const {
    editStartKey = 'F2',
    confirmKey = 'Enter',
    cancelKey = 'Escape',
    enableDoubleClickEdit = true,
    validateBeforeEdit,
    validateBeforeSave,
  } = config || {};
  
  return {
    name: 'inline-edit',
    version: '1.0.0',
    
    hooks: {
      // キーボードハンドラー
      onKeyDown: (event: KeyboardEvent, context) => {
        // F2キーで編集開始
        if (event.key === editStartKey) {
          const selectedNodes = context.selectedNodes;
          if (selectedNodes.length === 1) {
            event.preventDefault();
            // 編集開始ロジックをここに実装
            console.log(`Starting inline edit for node: ${selectedNodes[0]}`);
            return true; // イベントを処理したことを示す
          }
        }
        
        // Enter/Escapeキーで編集終了
        if (context.editingNodeId) {
          if (event.key === confirmKey) {
            event.preventDefault();
            console.log(`Confirming edit for node: ${context.editingNodeId}`);
            return true;
          } else if (event.key === cancelKey) {
            event.preventDefault();
            console.log(`Canceling edit for node: ${context.editingNodeId}`);
            return true;
          }
        }
        
        return false;
      },
      
      // ダブルクリックハンドラー
      onRowDoubleClick: (node, _event) => {
        if (!enableDoubleClickEdit) return false;
        
        // 編集可能かチェック
        if (validateBeforeEdit) {
          const canEdit = validateBeforeEdit(node);
          if (canEdit instanceof Promise) {
            canEdit.then(result => {
              if (result) {
                console.log(`Starting inline edit via double-click: ${node.id}`);
              }
            });
          } else if (canEdit) {
            console.log(`Starting inline edit via double-click: ${node.id}`);
          }
        } else {
          console.log(`Starting inline edit via double-click: ${node.id}`);
        }
        
        return true; // デフォルトのダブルクリック動作を防ぐ
      },
      
      // 編集状態変更ハンドラー
      onEditingStateChange: (editingNodeId) => {
        console.log(`Editing state changed: ${editingNodeId || 'none'}`);
      },
      
      // ノード更新前の検証
      onBeforeNodeUpdate: async (nodeId, newData) => {
        if (validateBeforeSave && newData.name) {
          // 型変換のための仮の実装
          const node = { id: nodeId, name: newData.name } as TreeNodeInUI;
          const isValid = await validateBeforeSave(node, newData.name);
          return isValid;
        }
        return true;
      },
      
      // ノード更新後の処理
      onAfterNodeUpdate: async (nodeId, newData) => {
        console.log(`Node ${nodeId} updated:`, newData);
      },
      
      // プラグイン初期化
      onPluginInit: () => {
        console.log('InlineEditPlugin initialized');
      },
      
      // プラグイン破棄
      onPluginDestroy: () => {
        console.log('InlineEditPlugin destroyed');
      },
    },
    
    config: {
      editStartKey,
      confirmKey,
      cancelKey,
      enableDoubleClickEdit,
    },
  };
}

// デフォルトのインライン編集プラグインインスタンス
export const inlineEditPlugin = createInlineEditPlugin();