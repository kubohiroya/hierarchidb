/**
 * TreeTable Utilities
 *
 * TreeTableで使用される共通ユーティリティ関数
 */

import type { TreeNode } from '../types';

/**
 * ノードの深度を計算
 */
export function calculateNodeDepth(node: TreeNode, allNodes: TreeNode[]): number {
  if (!node.parentNodeId && !node.parentId) {
    return 0;
  }

  const parentId = node.parentNodeId || node.parentId;
  if (!parentId) {
    return 0;
  }

  const parent = allNodes.find((n) => n.id === parentId || n.id === parentId);

  if (!parent) {
    return 0;
  }

  return 1 + calculateNodeDepth(parent, allNodes);
}

/**
 * ツリー構造をフラットなリストに変換
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedIds: Set<string>,
  parentId: string | null = null,
  depth: number = 0
): TreeNode[] {
  const result: TreeNode[] = [];

  // 指定された親の子ノードを取得
  const children = nodes.filter((node) => {
    const nodeParentId = node.parentNodeId || node.parentId;
    return nodeParentId === parentId;
  });

  // 子ノードをソートして処理
  children
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((child) => {
      // 深度情報を追加
      const childWithDepth = { ...child, depth };
      result.push(childWithDepth);

      // 展開されている場合は子ノードも追加
      if (expandedIds.has(child.id)) {
        result.push(...flattenTree(nodes, expandedIds, child.id, depth + 1));
      }
    });

  return result;
}

/**
 * ノードの子孫IDを取得
 */
export function getDescendantIds(nodeId: string, allNodes: TreeNode[]): Set<string> {
  const descendants = new Set<string>();

  function collectDescendants(currentId: string) {
    const children = allNodes.filter(
      (node) => node.parentNodeId === currentId || node.parentId === currentId
    );

    children.forEach((child) => {
      descendants.add(child.id);
      collectDescendants(child.id);
    });
  }

  collectDescendants(nodeId);
  return descendants;
}

/**
 * ノードの祖先IDを取得
 */
export function getAncestorIds(nodeId: string, allNodes: TreeNode[]): string[] {
  const ancestors: string[] = [];

  function collectAncestors(currentId: string) {
    const node = allNodes.find((n) => n.id === currentId);
    if (!node) return;

    const parentId = node.parentNodeId || node.parentId;
    if (parentId) {
      ancestors.unshift(parentId);
      collectAncestors(parentId);
    }
  }

  collectAncestors(nodeId);
  return ancestors;
}

/**
 * 検索テキストに基づいてノードをフィルタリング
 */
export function filterNodesBySearch(nodes: TreeNode[], searchText: string): TreeNode[] {
  if (!searchText.trim()) {
    return nodes;
  }

  const lowerSearchText = searchText.toLowerCase();
  const matchingNodes = new Set<string>();

  // 直接マッチするノードを探す
  nodes.forEach((node) => {
    if (node.name.toLowerCase().includes(lowerSearchText)) {
      matchingNodes.add(node.id);

      // マッチしたノードの祖先も含める
      getAncestorIds(node.id, nodes).forEach((ancestorId) => {
        matchingNodes.add(ancestorId);
      });

      // マッチしたノードの子孫も含める
      getDescendantIds(node.id, nodes).forEach((descendantId) => {
        matchingNodes.add(descendantId);
      });
    }
  });

  return nodes.filter((node) => matchingNodes.has(node.id));
}

/**
 * ノードのパスを文字列として取得
 */
export function getNodePath(
  nodeId: string,
  allNodes: TreeNode[],
  separator: string = ' > '
): string {
  const ancestors = getAncestorIds(nodeId, allNodes);
  const node = allNodes.find((n) => n.id === nodeId);

  if (!node) return '';

  const pathNodes = [
    ...ancestors.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean),
    node,
  ];

  return pathNodes.map((n) => n!.name).join(separator);
}

/**
 * ドラッグ&ドロップが有効かチェック
 */
export function canDropNode(
  draggingNodeId: string,
  targetNodeId: string,
  _position: 'before' | 'after' | 'into',
  allNodes: TreeNode[]
): boolean {
  // 自分自身にはドロップできない
  if (draggingNodeId === targetNodeId) {
    return false;
  }

  // 子孫にはドロップできない
  const descendants = getDescendantIds(draggingNodeId, allNodes);
  if (descendants.has(targetNodeId)) {
    return false;
  }

  // その他のビジネスルールがあればここに追加

  return true;
}
