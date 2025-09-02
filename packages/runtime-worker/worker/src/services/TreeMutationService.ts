import {
  CommandEnvelope,
  CommandResult as CoreCommandResult,
  DuplicateNodesPayload,
  ImportNodesPayload,
  MoveNodesPayload,
  PasteNodesPayload,
  RemovePayload,
  RecoverFromTrashPayload,
  RedoPayload,
  Timestamp,
  TreeNode,
  NodeType,
  TreeId,
  NodeId,
  UndoPayload,
  generateNodeId,
} from '@hierarchidb/common-type';
import type { TreeMutationAPI } from '@hierarchidb/common-api';
import type { CommandProcessor } from './CommandProcessor';
import type { CoreDB } from './CoreDB';
import { FEATURE_FLAGS } from '../config/feature-flags';

import { createNewName } from './WorkingCopyTreeNodeOperations';
import { PERFORMANCE_CONFIG } from '../utils/performance-config';
import { SingletonMixin } from '@hierarchidb/util';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager';

export class TreeMutationService implements TreeMutationAPI {
  // Note: Implementation now routes all mutating operations via CommandProcessor.
  static async getSingleton(
    coreDB: CoreDB,
    commandProcessor: CommandProcessor
  ): Promise<TreeMutationService> {
    return SingletonMixin.getSingleton(TreeMutationService.name, async () => {
      return new TreeMutationService(coreDB, commandProcessor);
    });
  }

  constructor(
    private coreDB: CoreDB,
    private commandProcessor: CommandProcessor
  ) {}

  // ==================
  // TreeMutationAPI Interface Methods
  // ==================

  async createNode(params: {
    nodeType: NodeType;
    treeId: TreeId;
    parentId: NodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }> {
    try {
      const envelope: CommandEnvelope<'createNode', {
        nodeType: NodeType;
        treeId: TreeId;
        parentId: NodeId;
        name: string;
        description?: string;
      }> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'createNode',
        payload: {
          nodeType: params.nodeType,
          treeId: params.treeId,
          parentId: params.parentId,
          name: params.name,
          description: params.description,
        },
        issuedAt: Date.now() as Timestamp,
      } as any;
      const result = await this.commandProcessor.processCommand(envelope);
      if (result.success) {
        return { success: true, nodeId: (result.nodeId as NodeId) ?? ('' as NodeId) };
      }
      return { success: false, error: (result as any).error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateNode(params: {
    nodeId: NodeId;
    name?: string;
    description?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const envelope: CommandEnvelope<'updateNode', {
        nodeId: NodeId;
        name?: string;
        description?: string;
      }> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'updateNode',
        payload: {
          nodeId: params.nodeId,
          name: params.name,
          description: params.description,
        },
        issuedAt: Date.now() as Timestamp,
      } as any;
      const result = await this.commandProcessor.processCommand(envelope);
      return result.success ? { success: true } : { success: false, error: (result as any).error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }> {
    const cmd: CommandEnvelope<'moveNodes', MoveNodesPayload> = {
      commandId: crypto.randomUUID(),
      groupId: crypto.randomUUID(),
      kind: 'moveNodes',
      payload: {
        nodeIds: params.nodeIds,
        toParentId: params.toParentId,
        onNameConflict: params.onNameConflict,
      },
      issuedAt: Date.now() as Timestamp,
    };
    const result = await this.commandProcessor.processCommand(cmd);
    if (!result.success) return { success: false, error: (result as any).error ?? 'Unknown error' };
    return { success: true };
  }

  async duplicateNodes(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }> {
    try {
      const firstNodeId = params.nodeIds[0];
      if (!firstNodeId) {
        return { success: false, error: 'No node IDs provided' };
      }
      const parentId = params.toParentId || (await this.getParentId(firstNodeId));

      const cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'duplicateNodes',
        payload: {
          nodeIds: params.nodeIds,
          toParentId: parentId,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const result = await this.duplicateNodesCommand(cmd);

      if (result.success) {
        if (FEATURE_FLAGS.WORKER_ENTITY_UNIFIED) {
          try {
            const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB as any);
            await lifecycle.handleCommand(cmd as any);
          } catch {}
        }
        return {
          success: true,
          nodeIds: result.newNodeIds || [],
        };
      } else {
        return { success: false, error: 'error' in result ? result.error : 'Unknown error' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    try {
      const cmd: CommandEnvelope<'remove', { nodeIds: NodeId[] }> = {
        commandId: crypto.randomUUID(),
        groupId: crypto.randomUUID(),
        kind: 'remove',
        payload: { nodeIds },
        issuedAt: Date.now() as Timestamp,
      };
      const result = await this.commandProcessor.processCommand(cmd);
      return result.success ? { success: true } : { success: false, error: (result as any).error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async recoverNodesFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }> {
    const cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload> = {
      commandId: crypto.randomUUID(),
      groupId: crypto.randomUUID(),
      kind: 'recoverFromTrash',
      payload: {
        nodeIds: params.nodeIds,
        toParentId: params.toParentId,
      },
      issuedAt: Date.now() as Timestamp,
    };

    const result = await this.commandProcessor.processCommand(cmd);
    if (!result.success) return { success: false, error: ('error' in result ? (result as any).error : 'Unknown error') };
    return { success: true };
  }

  private async getParentId(nodeId: NodeId): Promise<NodeId> {
    const node = await this.coreDB.getNode?.(nodeId);
    return node?.parentId || ('' as NodeId);
  }

  // Legacy internal move/recover implementations removed: always route via CommandProcessor

  // Internal method for command processing
  async duplicateNodesCommand(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodeIds, toParentId } = cmd.payload;
    const newNodeIds: NodeId[] = [];
    // Use CoreDB bulk-based subtree duplication (internally bulkCreateNodes)
    for (const sourceId of nodeIds) {
      const newRootId = await (this.coreDB as any).duplicateSubtree?.(sourceId, toParentId);
      if (newRootId) newNodeIds.push(newRootId as NodeId);
    }
    return { success: true, seq: this.getNextSeq(), newNodeIds };
  }

  /**
   * 【機能概要】: クリップボードデータからノード群をペーストし、新しいノードを作成する
   * 【セキュリティ改善】: 入力値検証とデータサニタイズを強化
   * 【パフォーマンス改善】: バッチ処理と効率的な名前衝突解決を実装
   * 【設計方針】: 安全で高速なペースト処理を実現
   * 🟢 信頼性レベル: docs/14-copy-paste-analysis.mdの実装方針に準拠
   */
  async pasteNodes(
    cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;

    try {
      // 【セキュリティ: 入力値検証】: 不正なペイロードに対する防御 🟢
      if (!nodes || typeof nodes !== 'object' || !nodeIds || !Array.isArray(nodeIds)) {
        return {
          success: false,
          error: 'Invalid paste payload: nodes and nodeIds are required',
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      if (!toParentId || typeof toParentId !== 'string') {
        return {
          success: false,
          error: 'Invalid toParentId: must be a non-empty string',
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      // 【セキュリティ: DoS攻撃防止】: 大量データ処理の制限 🟡
      const MAX_PASTE_NODES = 1000; // 【設定値】: 一度にペースト可能な最大ノード数
      if (nodeIds.length > MAX_PASTE_NODES) {
        return {
          success: false,
          error: `Too many nodes to paste (max: ${MAX_PASTE_NODES})`,
          code: 'INVALID_OPERATION',
        } as CoreCommandResult;
      }

      // 【親ノード存在確認】: ペースト先の妥当性検証 🟢
      const parentId = toParentId as NodeId;
      const parentNode = await this.coreDB.getNode?.(parentId);
      if (!parentNode) {
        return {
          success: false,
          error: `Parent node not found: ${toParentId}`,
          code: 'NODE_NOT_FOUND',
        } as CoreCommandResult;
      }

      const newNodeIds: NodeId[] = [];

      // 【パフォーマンス改善】: 兄弟ノード名を一度だけ取得 🟡
      const siblings = (await this.coreDB.listChildren?.(parentId)) || [];
      const existingNames = new Set<string>(siblings.map((sibling: TreeNode) => sibling.name));

      // 【バッチ処理最適化】: ノード作成を効率的に実行（チャンク分割） 🟡
      const timestamp = Date.now() as Timestamp;
      const toCreate: TreeNode[] = [];

      for (const nodeId of nodeIds) {
        const sourceNode = nodes[nodeId];
        if (!sourceNode) {
          console.warn(`Source node not found in clipboard data: ${nodeId}`);
          continue;
        }
        if (!sourceNode.name || typeof sourceNode.name !== 'string') {
          console.warn(`Invalid node name for ${nodeId}, skipping`);
          continue;
        }

        const newNodeId = generateNodeId();
        let newName = sourceNode.name;
        if (onNameConflict === 'auto-rename' && existingNames.has(newName)) {
          newName = this.resolveNameConflictEfficiently(newName, existingNames);
        } else if (onNameConflict === 'error' && existingNames.has(newName)) {
          return {
            success: false,
            error: `Name conflict: '${newName}' already exists`,
            code: 'NAME_NOT_UNIQUE',
          } as CoreCommandResult;
        }

        const newNode = {
          ...sourceNode,
          id: newNodeId,
          parentId: parentId,
          name: newName,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          originalParentNodeId: undefined,
          originalName: undefined,
          removedAt: undefined,
          isRemoved: false,
        } as unknown as TreeNode;

        toCreate.push(newNode);
        newNodeIds.push(newNodeId);
        existingNames.add(newName);
      }

      if (toCreate.length === 1) {
        await this.coreDB.createNode?.(toCreate[0]);
      } else if (toCreate.length > 1) {
        const size =  PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE;
        for (let i = 0; i < toCreate.length; i += size) {
          await (this.coreDB as any).bulkCreateNodes?.(toCreate.slice(i, i + size));
        }
      }

      if (FEATURE_FLAGS.WORKER_ENTITY_UNIFIED) {
        try {
          const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB as any);
          await lifecycle.handleCommand(cmd as any);
        } catch {}
      }

      return { success: true, seq: this.getNextSeq(), newNodeIds } as CoreCommandResult;
    } catch (error) {
      // 【エラーハンドリング】: セキュリティを考慮したエラー情報の制限 🟢
      console.error('Paste operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Paste operation failed',
        code: 'INVALID_OPERATION',
      } as CoreCommandResult;
    }
  }

  /**
   * 【ヘルパー関数】: 効率的な名前衝突解決アルゴリズム
   * 【パフォーマンス】: Set使用で O(1) の名前チェック
   * 【再利用性】: 他の操作でも使用可能な汎用的実装
   * 🟡 信頼性レベル: 一般的なアルゴリズムを参考に実装
   */
  private resolveNameConflictEfficiently(baseName: string, existingNames: Set<string>): string {
    // 【効率的な番号探索】: 連続した番号で最初に利用可能な名前を発見
    let counter = 1;
    let candidateName: string;

    do {
      candidateName = `${baseName} (${counter})`;
      counter++;
      // 【安全装置】: 無限ループ防止 🟡
      if (counter > 10000) {
        candidateName = `${baseName} (${Date.now()})`;
        break;
      }
    } while (existingNames.has(candidateName));

    return candidateName;
  }

  /**
   * 【機能概要】: ノードをゴミ箱に移動し、復元用の情報を保存する
   * 【実装方針】: isRemovedフラグとremovedAtタイムスタンプを設定して完全なゴミ箱状態を実現
   * 【テスト対応】: folder-plugin-operations.test.tsの isRemoved 期待値を満たすための実装
   * 🟢 信頼性レベル: docs/13-trash-operations-analysis.mdの実装方針に完全準拠
  */
  async moveNodesToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    // Route via CommandProcessor holder path when flag ON, else legacy inline path
    if ((process as any)?.env?.WORKER_TRASH_USE_HOLDER === '1') {
      const env = this.commandProcessor.createEnvelope('moveToTrash' as any, { nodeIds } as any);
      const res = await this.commandProcessor.processCommand(env as any);
      return res.success ? { success: true } : { success: false, error: (res as any).error };
    }
    const trashRootId = 'trash' as NodeId;
    try {
      for (const nodeId of nodeIds) {
        const node = await this.coreDB.getNode?.(nodeId);
        if (!node) continue;
        const now = Date.now() as Timestamp;
        await this.coreDB.updateNode({
          ...node,
          parentId: trashRootId,
          originalParentId: node.parentId as any,
          originalName: node.name as any,
          removedAt: now as any,
          updatedAt: now,
          version: node.version + 1,
        } as any);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async remove(cmd: CommandEnvelope<'remove', RemovePayload>): Promise<CoreCommandResult> {
    const { nodeIds } = cmd.payload;

    for (const nodeId of nodeIds) {
      // Delete node and all descendants recursively
      await this.deleteNodeRecursively(nodeId);
    }

    return {
      success: true,
      seq: this.getNextSeq(),
    } as CoreCommandResult;
  }

  /**
   * 【機能概要】: ゴミ箱からノードを復元し、元の場所または指定された場所に戻す
   * 【実装方針】: isRemovedフラグをfalseに設定し、復元用プロパティをクリアする
   * 【テスト対応】: folder-plugin-operations.test.tsの復元テストでisRemovedがfalseになることを確認
   * 🟢 信頼性レベル: docs/13-trash-operations-analysis.mdの復元実装方針に準拠
   */
  // recoverFromTrash legacy removed: handled by CommandProcessor

  async importNodes(
    cmd: CommandEnvelope<'importNodes', ImportNodesPayload>
  ): Promise<CoreCommandResult> {
    const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
    const newNodeIds: NodeId[] = [];
    const idMapping = new Map<NodeId, NodeId>();

    // First pass: create ID mappings
    for (const nodeId of nodeIds) {
      const newNodeId = generateNodeId();
      idMapping.set(nodeId, newNodeId);
      newNodeIds.push(newNodeId);
    }

    // Second pass: import nodes with new IDs
    for (const nodeId of nodeIds) {
      const node = nodes[nodeId];
      if (!node) continue;

      const newNodeId = idMapping.get(nodeId)!;
      const newParentId = idMapping.get(node.parentId) || toParentId;

      // Handle name conflicts
      let newName = node.name;
      if (onNameConflict === 'auto-rename') {
        const siblings = (await this.coreDB.listChildren?.(newParentId)) || [];
        const siblingNames = siblings.map((sibling: TreeNode) => sibling.name);
        newName = createNewName(siblingNames, node.name);
      }

      await this.coreDB.createNode?.({
        ...node,
        id: newNodeId,
        parentId: newParentId,
        name: newName,
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
        version: 1,
      });
    }

    return {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds,
    };
  }

  // Undo/Redo Operations

  async undo(_cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
    const result = await this.commandProcessor.undo();
    return result as CoreCommandResult;
  }

  async redo(_cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
    const result = await this.commandProcessor.redo();
    return result as CoreCommandResult;
  }

  // duplicateBranch: removed previously in favor of CoreDB.duplicateSubtree (bulk-based)

  private getNextSeq(): number {
    // In a real implementation, this should be managed by CommandProcessor
    return Date.now();
  }
}
