/**
 * Keyboard Navigation Plugin
 * 
 * TreeTableにキーボードナビゲーション機能を追加するプラグイン
 */

import type { TreeTablePlugin } from '../plugin/types';
import { KeyboardEvent } from 'react';

/**
 * キーボードナビゲーションプラグインの設定
 */
export interface KeyboardNavigationPluginConfig {
  /**
   * 矢印キーでナビゲーションするか（デフォルト: true）
   */
  enableArrowKeyNavigation?: boolean;
  
  /**
   * Spaceキーで選択トグルするか（デフォルト: true）
   */
  enableSpaceKeySelection?: boolean;
  
  /**
   * Ctrl+Aで全選択するか（デフォルト: true）
   */
  enableSelectAll?: boolean;
  
  /**
   * Shift+矢印で範囲選択するか（デフォルト: true）
   */
  enableRangeSelection?: boolean;
  
  /**
   * 展開/折りたたみショートカットを有効化（左右矢印）
   */
  enableExpandCollapseKeys?: boolean;
}

/**
 * キーボードナビゲーションプラグインを作成
 */
export function createKeyboardNavigationPlugin(config?: KeyboardNavigationPluginConfig): TreeTablePlugin {
  const {
    enableArrowKeyNavigation = true,
    enableSpaceKeySelection = true,
    enableSelectAll = true,
    enableRangeSelection = true,
    enableExpandCollapseKeys = true,
  } = config || {};
  
  // let lastSelectedIndex = -1; // TODO: 実装時に使用
  
  return {
    name: 'keyboard-navigation',
    version: '1.0.0',
    
    hooks: {
      // キーボードハンドラー
      onKeyDown: (event: KeyboardEvent, context) => {
        const { selectedNodes, expandedNodes } = context;
        
        // 上下矢印でナビゲーション
        if (enableArrowKeyNavigation && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          
          // ナビゲーションロジック
          console.log(`Navigating ${event.key === 'ArrowUp' ? 'up' : 'down'}`);
          
          // Shiftキーが押されている場合は範囲選択
          if (event.shiftKey && enableRangeSelection) {
            console.log('Range selection with arrow key');
          }
          
          return true;
        }
        
        // 左右矢印で展開/折りたたみ
        if (enableExpandCollapseKeys && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          const currentNode = selectedNodes[0];
          if (currentNode) {
            event.preventDefault();
            
            if (event.key === 'ArrowLeft') {
              // 折りたたみ
              if (expandedNodes.includes(currentNode)) {
                console.log(`Collapsing node: ${currentNode}`);
              } else {
                // 親ノードへ移動
                console.log(`Moving to parent node`);
              }
            } else {
              // 展開
              if (!expandedNodes.includes(currentNode)) {
                console.log(`Expanding node: ${currentNode}`);
              } else {
                // 最初の子ノードへ移動
                console.log(`Moving to first child`);
              }
            }
            
            return true;
          }
        }
        
        // Spaceキーで選択トグル
        if (enableSpaceKeySelection && event.key === ' ') {
          event.preventDefault();
          const currentNode = selectedNodes[0];
          if (currentNode) {
            console.log(`Toggling selection for node: ${currentNode}`);
          }
          return true;
        }
        
        // Ctrl+A/Cmd+Aで全選択
        if (enableSelectAll && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          console.log('Selecting all nodes');
          return true;
        }
        
        // Escapeで選択解除
        if (event.key === 'Escape' && selectedNodes.length > 0) {
          event.preventDefault();
          console.log('Clearing selection');
          return true;
        }
        
        // Home/Endキーでファーストラスト移動
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          console.log(`Moving to ${event.key === 'Home' ? 'first' : 'last'} node`);
          return true;
        }
        
        // Page Up/Page Downでページ移動
        if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault();
          console.log(`Page ${event.key === 'PageUp' ? 'up' : 'down'}`);
          return true;
        }
        
        return false;
      },
      
      // 選択変更時のハンドラー
      onSelectionChange: (selectedIds) => {
        console.log(`Selection changed: ${selectedIds.length} nodes selected`);
        
        // 最後に選択したインデックスを記録（範囲選択のため）
        if (selectedIds.length === 1) {
          // TODO: インデックスの取得ロジック
          // lastSelectedIndex = 0;
        }
      },
      
      // 展開状態変更時のハンドラー
      onExpansionChange: (expandedIds) => {
        console.log(`Expansion changed: ${expandedIds.length} nodes expanded`);
      },
      
      // プラグイン初期化
      onPluginInit: () => {
        console.log('KeyboardNavigationPlugin initialized');
        
        // グローバルなキーボードイベントリスナーの追加が必要な場合
        // document.addEventListener('keydown', globalKeyHandler);
      },
      
      // プラグイン破棄
      onPluginDestroy: () => {
        console.log('KeyboardNavigationPlugin destroyed');
        
        // グローバルなキーボードイベントリスナーの削除
        // document.removeEventListener('keydown', globalKeyHandler);
      },
    },
    
    config: {
      enableArrowKeyNavigation,
      enableSpaceKeySelection,
      enableSelectAll,
      enableRangeSelection,
      enableExpandCollapseKeys,
    },
  };
}

// デフォルトのキーボードナビゲーションプラグインインスタンス
export const keyboardNavigationPlugin = createKeyboardNavigationPlugin();