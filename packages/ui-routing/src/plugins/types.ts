/**
 * 階層的プラグインルーティングシステム - 型定義
 * Types for Hierarchical Plugin Router - TDD Red Phase
 */

import { ComponentType, LazyExoticComponent } from 'react';
import { LoaderFunction, ActionFunction } from 'react-router-dom';

/**
 * プラグインルートパラメータ
 * 階層的URLから解析されるパラメータの型定義
 */
export interface PluginRouteParams {
  treeId: string;
  pageTreeNodeId?: string;
  targetTreeNodeId?: string;
  treeNodeType?: string;
  action?: string;
}

/**
 * プラグインアクション定義
 * 各アクションに対応するコンポーネントと権限設定
 */
export interface PluginAction {
  component: LazyExoticComponent<ComponentType<any>>;
  loader?: LoaderFunction;
  action?: ActionFunction;
  permissions?: string[];
}

/**
 * プラグイン定義
 * プラグインの完全な定義構造
 */
export interface PluginDefinition {
  nodeType: string;
  actions: {
    [actionName: string]: PluginAction;
  };
}

/**
 * 階層ルートデータ
 * useLoaderDataで取得される統合データの構造
 */
export interface HierarchicalRouteData {
  treeContext: {
    tree: TreeData;
    currentNode: TreeNodeData;
    breadcrumbs: TreeNodeData[];
    expandedNodes: string[];
  };
  targetNode: TreeNodeData;
  pluginData: any;
  permissions: string[];
}

/**
 * ツリーデータ（プレースホルダー）
 */
export interface TreeData {
  id: string;
  name: string;
  rootNodeId: string;
}

/**
 * ツリーノードデータ（プレースホルダー）
 */
export interface TreeNodeData {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  children?: string[];
}

/**
 * 権限チェック結果
 */
export interface PermissionCheckResult {
  allowed: boolean;
  userPermissions: string[];
  requiredPermissions: string[];
  deniedPermissions?: string[];
}
