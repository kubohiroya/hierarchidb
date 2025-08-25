import { generateNodeId, type NodeId } from '@hierarchidb/common-core';
import { workerWarn } from '../utils/workerLogger';

/**
 * 高度なツリー操作機能を提供するモジュール
 *
 * eria-cartographから移植される効率的なツリー操作アルゴリズムを実装します。
 * - ブランチ複製機能
 * - 子孫グループ化機能
 * - 全子孫取得機能
 */

// 暫定的な型定義（実際の実装で使用）
type CoreDB = any;

/**
 * 指定されたノード以下の部分木全体を新しい親に複製します
 *
 * @param db - データベースインスタンス
 * @param sourceId - 複製元のルートノード
 * @param newParentId - 複製先の親ノード
 * @param idMapping - 旧IDと新IDのマッピング（出力用）
 * @param branchRootMode - ルートノード名に"(Copy)"を付与するか
 */
export async function duplicateBranch(
  db: CoreDB,
  sourceId: NodeId,
  newParentId: NodeId,
  idMapping: Map<NodeId, NodeId>,
  branchRootMode = true
): Promise<void> {
  // Phase 2: エラーハンドリング機能の実装

  // 循環参照検出のためのvisited Set
  const visited = new Set<NodeId>();

  return duplicateBranchRecursive(db, sourceId, newParentId, idMapping, branchRootMode, visited);
}

async function duplicateBranchRecursive(
  db: CoreDB,
  sourceId: NodeId,
  newParentId: NodeId,
  idMapping: Map<NodeId, NodeId>,
  branchRootMode: boolean,
  visited: Set<NodeId>
): Promise<void> {
  // 循環参照チェック
  if (visited.has(sourceId)) {
    throw new Error('Circular reference detected');
  }
  visited.add(sourceId);

  // ソースノードを取得
  const sourceNode = await db.treeNodes.get(sourceId);
  if (!sourceNode) {
    throw new Error('Source node not found');
  }

  // 親ノードの存在確認（nullでない場合のみ）
  if (newParentId !== null) {
    const parentNode = await db.treeNodes.get(newParentId);
    if (!parentNode) {
      throw new Error('Parent node not found');
    }
  }

  const newId = generateNodeId() as NodeId;

  // 複製ノードを作成
  const duplicatedNode = {
    ...sourceNode,
    id: newId,
    parentId: newParentId,
    name: branchRootMode ? `${sourceNode.name} (Copy)` : sourceNode.name,
  };

  // データベースに追加
  await db.treeNodes.add(duplicatedNode);

  // IDマッピングに記録
  idMapping.set(sourceId, newId);

  // 子ノードがあれば再帰的に処理
  const children = await db.treeNodes.where('parentId').equals(sourceId).toArray();

  for (const child of children) {
    await duplicateBranchRecursive(db, child.id, newId, idMapping, false, visited); // 子ノードは(Copy)なし
  }

  // visitedから除去（他の枝での再訪を許可）
  visited.delete(sourceId);
}

/**
 * ノードIDリストから親子関係のないトップレベルノードのみを抽出します
 *
 * @param db - データベースインスタンス
 * @param ids - 対象ノードIDの配列
 * @returns トップレベルノードの配列
 */
export async function groupDescendants(db: CoreDB, ids: NodeId[]): Promise<any[]> {
  // Phase 3: 基本的なグループ化機能の実装

  if (ids.length === 0) {
    return [];
  }

  // IDセットを作成（高速検索用）
  const idSet = new Set(ids);
  const topLevelNodes: any[] = [];

  // 各ノードについて、その祖先がIDセットに含まれるかチェック
  for (const nodeId of ids) {
    const node = await db.treeNodes.get(nodeId);
    if (!node) {
      // 存在しないノードは無視
      continue;
    }

    const isTopLevel = await isTopLevelInSet(db, node, idSet);
    if (isTopLevel) {
      topLevelNodes.push(node);
    }
  }

  return topLevelNodes;
}

/**
 * ノードがIDセット内でトップレベル（親がセットに含まれない）かどうかを判定
 */
async function isTopLevelInSet(db: CoreDB, node: any, idSet: Set<NodeId>): Promise<boolean> {
  let currentNodeId = node.parentId;
  const MAX_DEPTH = 50; // 循環参照対策
  let depth = 0;

  // 親をたどってIDセット内に含まれるかチェック
  while (currentNodeId && depth < MAX_DEPTH) {
    if (idSet.has(currentNodeId)) {
      // 親がIDセット内にある場合、このノードはトップレベルではない
      return false;
    }

    const parentNode = await db.treeNodes.get(currentNodeId);
    if (!parentNode) {
      // 親ノードが見つからない場合はトップレベル扱い
      break;
    }

    currentNodeId = parentNode.parentId;
    depth++;
  }

  // 循環参照の検出
  if (depth >= MAX_DEPTH) {
    workerWarn(`Possible circular reference detected for node ${node.id}`);
  }

  return true;
}

/**
 * 指定ノード以下の全ての子孫ノードIDを効率的に取得します
 *
 * @param db - データベースインスタンス
 * @param nodeId - ルートノードID
 * @returns 全子孫ノードIDの配列
 */
export async function getAllDescendants(db: CoreDB, nodeId: NodeId): Promise<NodeId[]> {
  // Phase 4: 基本的な全子孫取得機能の実装

  const rootNode = await db.treeNodes.get(nodeId);
  if (!rootNode) {
    // ルートノードが存在しない場合は空配列を返す
    return [];
  }

  const descendants: NodeId[] = [];
  const queue: NodeId[] = [nodeId];
  const visited = new Set<NodeId>(); // 循環参照対策

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;

    if (visited.has(currentNodeId)) {
      workerWarn(`Circular reference detected for node ${currentNodeId}`);
      continue;
    }
    visited.add(currentNodeId);

    // 子ノードを取得
    const children = await db.treeNodes.where('parentId').equals(currentNodeId).toArray();

    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id); // 孫以下の処理のためキューに追加
    }
  }

  return descendants;
}
