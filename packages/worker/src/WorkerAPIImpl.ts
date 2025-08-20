import type { WorkerAPI } from '@hierarchidb/api';
import type {
  CommandEnvelope,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  CopyNodesPayload,
  CommandResult as CoreCommandResult,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  DuplicateNodesPayload,
  ExpandedStateChanges,
  ExportNodesPayload,
  GetAncestorsPayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetNodePayload,
  ImportNodesPayload,
  MoveNodesPayload,
  MoveToTrashPayload,
  ObserveChildrenPayload,
  ObserveNodePayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
  PasteNodesPayload,
  RemovePayload,
  RecoverFromTrashPayload,
  RedoPayload,
  SearchNodesPayload,
  SubTreeChanges,
  Tree,
  TreeChangeEvent,
  TreeId,
  TreeNode,
  TreeNodeId,
  TreeNodeType,
  UndoPayload,
} from '@hierarchidb/core';
import type { Observable } from 'rxjs';
import { CommandProcessor } from './command/CommandProcessor';

/**
 * 【型定義】: クリップボードデータの構造
 * 【設計方針】: any型を排除した型安全なデータ形式
 * 🟢 信頼性レベル: Copy&Paste分析資料に基づく型定義
 */
interface ClipboardData {
  type: 'nodes-copy';
  timestamp: number;
  nodes: Record<string, TreeNode>;
  rootNodeIds: string[];
  nodeCount?: number;
}

/**
 * 【アーキテクチャ改善】: CoreDBアダプターによる依存性注入の最適化
 * 【設計方針】: Adapter Patternによる既存システムとの統合
 * 【改善内容】: 型安全性とテスタビリティの向上
 * 🟢 信頼性レベル: GOFデザインパターンに準拠した実装
 */
class CoreDBAdapter {
  constructor(private coreDB: CoreDB) {}

  /**
   * 【ノード削除アダプテーション】: CoreDBの削除メソッドへの委譲
   */
  async deleteNode(nodeId: TreeNodeId): Promise<void> {
    await this.coreDB.deleteNode(nodeId);
  }

  /**
   * 【ノード作成アダプテーション】: CoreDBの作成メソッドへの委譲
   */
  async createNode(node: TreeNode): Promise<void> {
    await this.coreDB.createNode(node);
  }
}
import type { CommandResult } from './command/types';
import { CoreDB } from './db/CoreDB';
import { EphemeralDB } from './db/EphemeralDB';
import { NodeLifecycleManager } from './lifecycle/NodeLifecycleManager';
import { SimpleNodeTypeRegistry } from './registry/SimpleNodeTypeRegistry';
import { TreeMutationServiceImpl } from './services/TreeMutationServiceImpl';
import { TreeObservableServiceImpl } from './services/TreeObservableServiceImpl';
import { TreeQueryServiceImpl } from './services/TreeQueryServiceImpl';
import { ImportService } from './services/ImportService';
import { ExportService } from './services/ExportService';
import { 
  getRegisteredPlugins, 
  getPluginDefinition, 
  isNodeTypeRegistered,
  getCreatableNodeTypes 
} from './registry/plugin-registry-api';

export class WorkerAPIImpl implements WorkerAPI {
  private coreDB: CoreDB;
  private ephemeralDB: EphemeralDB;
  private queryService: TreeQueryServiceImpl;
  private mutationService: TreeMutationServiceImpl;
  private observableService: TreeObservableServiceImpl;
  private commandProcessor: CommandProcessor;
  private nodeTypeRegistry: SimpleNodeTypeRegistry;
  private nodeLifecycleManager: NodeLifecycleManager;

  constructor(dbName: string = 'default-worker-db') {
    this.coreDB = new CoreDB(dbName);
    this.ephemeralDB = new EphemeralDB(dbName);

    // 【アーキテクチャ改善】: コンストラクタベースの依存性注入による堅牢な設計 🟢
    const databaseAdapter = new CoreDBAdapter(this.coreDB);
    this.commandProcessor = new CommandProcessor(databaseAdapter);
    
    this.nodeTypeRegistry = new SimpleNodeTypeRegistry();
    this.nodeLifecycleManager = new NodeLifecycleManager(
      this.nodeTypeRegistry,
      this.coreDB,
      this.ephemeralDB
    );
    this.queryService = new TreeQueryServiceImpl(this.coreDB);
    this.mutationService = new TreeMutationServiceImpl(
      this.coreDB,
      this.ephemeralDB,
      this.commandProcessor,
      this.nodeLifecycleManager
    );
    this.observableService = new TreeObservableServiceImpl(this.coreDB);
  }

  async initialize(): Promise<void> {
    await Promise.all([this.coreDB.initialize(), this.ephemeralDB.initialize()]);
  }

  dispose(): void {
    this.coreDB.close();
    this.ephemeralDB.close();
  }

  getTree(params: { treeId: TreeId }): Promise<Tree | undefined> {
    return this.coreDB.getTree(params.treeId);
  }

  getTrees(): Promise<Tree[]> {
    return this.coreDB.getTrees();
  }

  /**
   * Get command processor instance
   */
  getCommandProcessor(): CommandProcessor {
    return this.commandProcessor;
  }

  /**
   * Get node type registry instance
   */
  getNodeTypeRegistry(): SimpleNodeTypeRegistry {
    return this.nodeTypeRegistry;
  }

  // TreeQueryService methods
  copyNodes(payload: CopyNodesPayload): Promise<CoreCommandResult> {
    return this.queryService.copyNodes(payload);
  }

  exportNodes(payload: ExportNodesPayload): Promise<CoreCommandResult> {
    return this.queryService.exportNodes(payload);
  }

  // TreeMutationService methods
  createWorkingCopyForCreate(
    cmd: CommandEnvelope<'createWorkingCopyForCreate', CreateWorkingCopyForCreatePayload>
  ): Promise<void> {
    return this.mutationService.createWorkingCopyForCreate(cmd);
  }

  createWorkingCopy(
    cmd: CommandEnvelope<'createWorkingCopy', CreateWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.createWorkingCopy(cmd);
  }

  discardWorkingCopyForCreate(
    cmd: CommandEnvelope<'discardWorkingCopyForCreate', DiscardWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.discardWorkingCopyForCreate(cmd);
  }

  discardWorkingCopy(
    cmd: CommandEnvelope<'discardWorkingCopy', DiscardWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.discardWorkingCopy(cmd);
  }

  commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.commitWorkingCopyForCreate(cmd);
  }

  commitWorkingCopy(
    cmd: CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.commitWorkingCopy(cmd);
  }

  moveNodes(cmd: CommandEnvelope<'moveNodes', MoveNodesPayload>): Promise<CoreCommandResult> {
    return this.mutationService.moveNodes(cmd);
  }

  duplicateNodes(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.duplicateNodes(cmd);
  }

  pasteNodes(
    cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.pasteNodes(cmd);
  }

  moveToTrash(
    cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.moveToTrash(cmd);
  }

  remove(
    cmd: CommandEnvelope<'remove', RemovePayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.remove(cmd);
  }

  recoverFromTrash(
    cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.recoverFromTrash(cmd);
  }

  importNodes(
    cmd: CommandEnvelope<'importNodes', ImportNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.importNodes(cmd);
  }

  async undo(_cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
    // Use CommandProcessor for undo
    const result = await this.commandProcessor.undo();
    return this.convertToCommandResult(result);
  }

  async redo(_cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
    // Use CommandProcessor for redo
    const result = await this.commandProcessor.redo();
    return this.convertToCommandResult(result);
  }

  /**
   * Convert internal CommandResult to Core CommandResult
   */
  private convertToCommandResult(result: CommandResult): CoreCommandResult {
    if (result.success) {
      const successResult: CoreCommandResult = {
        success: true,
        seq: result.seq,
      };
      
      if (result.nodeId) {
        successResult.nodeId = result.nodeId;
      }
      if (result.newNodeIds) {
        successResult.newNodeIds = result.newNodeIds;
      }
      if (result.clipboardData) {
        successResult.clipboardData = result.clipboardData;
      }
      
      return successResult;
    } else {
      const errorResult: CoreCommandResult = {
        success: false,
        error: result.error,
        code: result.code,
      };
      
      if (result.seq !== undefined) {
        errorResult.seq = result.seq;
      }
      
      return errorResult;
    }
  }

  // TreeObservableService methods
  subscribeSubTree(
    pageTreeNodeId: TreeNodeId,
    notifyExpandedChangesCallback: (changes: ExpandedStateChanges) => void,
    notifySubTreeChangesCallback: (changes: SubTreeChanges) => void
  ): Promise<{
    initialSubTree: Promise<SubTreeChanges>;
    unsubscribeSubTree: () => void;
  }> {
    return this.observableService.subscribeSubTree(
      pageTreeNodeId,
      notifyExpandedChangesCallback,
      notifySubTreeChangesCallback
    );
  }

  toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void> {
    return this.observableService.toggleNodeExpanded(pageTreeNodeId);
  }

  listChildren(parentId: TreeNodeId, doExpandNode?: boolean): Promise<SubTreeChanges> {
    return this.observableService.listChildren(parentId, doExpandNode);
  }

  getNodeAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]> {
    return this.observableService.getNodeAncestors(pageNodeId);
  }

  searchByNameWithDepth(
    rootNodeId: TreeNodeId,
    query: string,
    opts: {
      maxDepth: number;
      maxVisited?: number;
    }
  ): Promise<TreeNode[]> {
    return this.observableService.searchByNameWithDepth(rootNodeId, query, opts);
  }

  /**
   * Enhanced search API with multiple matching modes
   * 
   * Supports 4 matching modes:
   * - exact: Exact name match
   * - prefix: Name starts with query
   * - suffix: Name ends with query  
   * - partial: Name contains query (default)
   */
  searchByNameWithMatchMode(
    rootNodeId: TreeNodeId,
    query: string,
    opts: {
      matchMode: 'exact' | 'prefix' | 'suffix' | 'partial';
      maxResults?: number;
      caseSensitive?: boolean;
      searchInDescription?: boolean;
    }
  ): Promise<TreeNode[]> {
    return this.observableService.searchByNameWithMatchMode(rootNodeId, query, opts);
  }

  // Observable methods
  observeNode(
    cmd: CommandEnvelope<'observeNode', ObserveNodePayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeNode(cmd);
  }

  observeChildren(
    cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeChildren(cmd);
  }

  observeSubtree(
    cmd: CommandEnvelope<'observeSubtree', ObserveSubtreePayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeSubtree(cmd);
  }

  observeWorkingCopies(
    cmd: CommandEnvelope<'observeWorkingCopies', ObserveWorkingCopiesPayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeWorkingCopies(cmd);
  }

  // Query service overrides
  getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]> {
    return this.queryService.getAncestors(payload);
  }

  // Observable service management
  getActiveSubscriptions(): Promise<number> {
    return this.observableService.getActiveSubscriptions();
  }

  cleanupOrphanedSubscriptions(): Promise<void> {
    return this.observableService.cleanupOrphanedSubscriptions();
  }

  // Query service methods
  getNode(payload: GetNodePayload): Promise<TreeNode | undefined> {
    return this.queryService.getNode(payload);
  }

  getChildren(payload: GetChildrenPayload): Promise<TreeNode[]> {
    return this.queryService.getChildren(payload);
  }

  getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]> {
    return this.queryService.getDescendants(payload);
  }

  searchNodes(payload: SearchNodesPayload): Promise<TreeNode[]> {
    return this.queryService.searchNodes(payload);
  }

  // Orchestrated APIs - High-level APIs that orchestrate multiple low-level operations
  // These APIs provide developer-friendly interfaces by combining multiple command steps
  // into single, atomic operations with integrated error handling and cleanup.

  /**
   * Generic Node Creation API
   * 
   * Creates a new node of the specified type with proper validation and lifecycle management.
   * This method replaces type-specific creation methods like createFolder().
   * 
   * Orchestrates the complete node creation workflow:
   * 1. Create Working Copy
   * 2. Commit Working Copy  
   * 3. Cleanup on success/failure
   * 
   * @param params Node creation parameters including node type
   * @returns Promise with success status and created node ID
   */
  async create(params: {
    treeNodeType: TreeNodeType;
    treeId: string;
    parentNodeId: TreeNodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: TreeNodeId } | { success: false; error: string }> {
    try {
      // 【入力値検証】: ノード名の妥当性をチェックしてエラーを防ぐ 🟢
      if (!params.name || params.name.trim() === '') {
        return {
          success: false,
          error: 'Node name is required and cannot be empty',
        };
      }
      
      if (params.name.length > 255) {
        return {
          success: false,
          error: 'Node name cannot exceed 255 characters',
        };
      }

      // 【共通グループID生成】: undo/redo操作で同一グループとして扱うため 🟢
      const groupId = `${params.treeNodeType}-create-${Date.now()}`;
      const workingCopyId = `wc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 【Working Copy作成コマンド】: 作業コピーを作成してからコミットする2段階処理 🟢
      const createCmd = {
        payload: {
          workingCopyId,
          parentTreeNodeId: params.parentNodeId,
          name: params.name,
          description: params.description,
        },
        commandId: `create-${Date.now()}`,
        groupId: groupId,
        kind: 'createWorkingCopyForCreate' as const,
        issuedAt: Date.now(),
      };

      await this.createWorkingCopyForCreate(createCmd);

      // 【コミットコマンド】: 作業コピーを本データベースにコミット 🟢
      const commitCmd = {
        payload: {
          workingCopyId,
        },
        commandId: `commit-${Date.now()}`,
        groupId: groupId, // 【同じグループID使用】: 作成とコミットを1つのUndo単位として扱う
        kind: 'commitWorkingCopyForCreate' as const,
        issuedAt: Date.now(),
      };

      const commitResult = await this.commitWorkingCopyForCreate(commitCmd);

      if (commitResult.success) {
        const nodeId = commitResult.nodeId;

        if (nodeId === undefined) {
          console.error('commitResult.nodeId is undefined');
          return {
            success: false,
            error: `NodeId is undefined`,
          } as const;
        }

        // 【CommandProcessor記録】: Undo/Redoのためにコマンドをスタックに記録 🟢
        // 【テスト要件対応】: テストで期待されるundo/redo機能を実現するための記録処理
        const createCommand = {
          payload: {
            treeNodeType: params.treeNodeType,
            nodeId: nodeId,
            parentNodeId: params.parentNodeId,
            name: params.name,
            description: params.description,
          },
          commandId: `${params.treeNodeType}-create-${Date.now()}`,
          groupId: groupId,
          kind: 'create' as const, // 【汎用コマンド種別】: 汎用ノード作成用のコマンドタイプ
          issuedAt: Date.now(),
        };

        // 【コマンド記録実行】: CommandProcessorに汎用作成コマンドを記録
        await this.commandProcessor.processCommand(createCommand);
        
        // 【ノード存在確認】: デバッグ用の確認処理 🟢
        const createdNode = await this.coreDB.getNode(nodeId);
        if (!createdNode) {
          console.error('Node not found after creation:', nodeId);
          return {
            success: false,
            error: `Node not found after creation: ${nodeId}`,
          } as const;
        }
        
        return {
          success: true,
          nodeId: nodeId,
        } as const;
      } else {
        return {
          success: false,
          error: commitResult.success ? 'Unexpected success result' : commitResult.error,
        };
      }
    } catch (error) {
      // 【エラー処理】: 例外発生時の適切なエラーメッセージを返却 🟢
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Orchestrated Folder Move API
   * 
   * Orchestrates folder move operation with proper validation:
   * 1. Validate source and target nodes exist
   * 2. Check for circular references
   * 3. Execute move operation
   * 4. Handle naming conflicts if needed
   * 
   * @param params Move operation parameters
   * @returns Promise with success status and error details
   */
  async moveFolder(params: {
    nodeId: TreeNodeId;
    toParentId: TreeNodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const moveResult = await this.moveNodes({
        payload: {
          nodeIds: [params.nodeId],
          toParentId: params.toParentId,
          onNameConflict: params.onNameConflict || 'error',
        },
        commandId: `move-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'moveNodes',
        issuedAt: Date.now(),
      });
      
      return { 
        success: moveResult.success, 
        error: moveResult.success ? undefined : moveResult.error 
      };
    } catch (error) {
      return { 
        success: false, 
        error: String(error) 
      };
    }
  }

  /**
   * Convenience API: Create Folder
   * Wrapper around generic create() with treeNodeType set to 'folder'.
   */
  createFolder(params: {
    treeId: string;
    parentNodeId: TreeNodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: TreeNodeId } | { success: false; error: string }> {
    return this.create({
      treeNodeType: 'folder',
      treeId: params.treeId,
      parentNodeId: params.parentNodeId,
      name: params.name,
      description: params.description,
    });
  }

  /**
   * Orchestrated Folder Name Update API
   * 
   * Orchestrates the complete folder name update workflow:
   * 1. Create Working Copy for existing node
   * 2. Update name in Working Copy
   * 3. Commit changes
   * 4. Cleanup on success/failure
   * 
   * @param params Name update parameters
   * @returns Promise with success status and error details
   */
  async updateFolderName(params: {
    nodeId: TreeNodeId;
    newName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Validation
      if (!params.newName || params.newName.trim() === '') {
        return {
          success: false,
          error: 'Folder name is required and cannot be empty',
        };
      }
      
      if (params.newName.length > 255) {
        return {
          success: false,
          error: 'Folder name cannot exceed 255 characters',
        };
      }

      // 現在は直接ノードを更新（簡素化された実装）
      const node = await this.coreDB.getNode(params.nodeId);
      if (!node) {
        return {
          success: false,
          error: `Node not found: ${params.nodeId}`,
        };
      }

      await this.coreDB.updateNode({
        ...node,
        name: params.newName,
        updatedAt: Date.now(),
        version: node.version + 1,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Move to Trash API
   * 
   * @param params Trash operation parameters
   */
  async moveToTrashFolder(params: {
    nodeIds: TreeNodeId[];
  }): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const result = await this.moveToTrash({
        payload: { nodeIds: params.nodeIds },
        commandId: `trash-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'moveToTrash',
        issuedAt: Date.now(),
      });
      
      if (result.success) {
        return { success: true } as const;
      }
      return { success: false, error: result.error ?? 'Move to trash failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Recover from Trash API
   */
  async recoverFromTrashFolder(params: {
    nodeIds: TreeNodeId[];
    toParentId?: TreeNodeId;
  }): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const result = await this.recoverFromTrash({
        payload: { 
          nodeIds: params.nodeIds,
          toParentId: params.toParentId,
        },
        commandId: `recover-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'recoverFromTrash',
        issuedAt: Date.now(),
      });
      
      if (result.success) {
        return { success: true } as const;
      }
      return { success: false, error: result.error ?? 'Recover failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Permanent Delete API
   */
  async removeFolder(params: {
    nodeIds: TreeNodeId[];
  }): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const result = await this.remove({
        payload: { nodeIds: params.nodeIds },
        commandId: `delete-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'remove',
        issuedAt: Date.now(),
      });
      
      if (result.success) {
        return { success: true } as const;
      }
      return { success: false, error: result.error ?? 'Delete failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Duplicate Nodes API
   */
  async duplicateNodesFolder(params: {
    nodeIds: TreeNodeId[];
    toParentId?: TreeNodeId;
  }): Promise<{ success: true; nodeIds: TreeNodeId[] } | { success: false; error: string }> {
    try {
      const result = await this.duplicateNodes({
        payload: {
          nodeIds: params.nodeIds,
          toParentId: params.toParentId || 'root' as TreeNodeId,
        },
        commandId: `duplicate-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'duplicateNodes',
        issuedAt: Date.now(),
      });
      
      if (result.success && result.newNodeIds) {
        return { success: true, nodeIds: result.newNodeIds } as const;
      }
      return { success: false, error: 'Duplicate failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Copy Nodes API
   */
  async copyNodesFolder(params: {
    nodeIds: TreeNodeId[];
  }): Promise<{ success: true; clipboardData: ClipboardData } | { success: false; error: string }> {
    try {
      const result = await this.copyNodes({
        nodeIds: params.nodeIds,
      });
      
      if (result.success && result.clipboardData) {
        return { success: true, clipboardData: result.clipboardData} as const;
      }
      return { success: false, error: 'Copy failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Orchestrated Paste Nodes API
   */
  async pasteNodesFolder(params: {
    targetParentId: TreeNodeId;
    clipboardData: ClipboardData;
  }): Promise<{ success: true; nodeIds: TreeNodeId[] } | { success: false; error: string }> {
    try {
      const result = await this.pasteNodes({
        payload: {
          nodes: params.clipboardData?.nodes || {},
          nodeIds: params.clipboardData?.rootNodeIds || [],
          toParentId: params.targetParentId,
        },
        commandId: `paste-${Date.now()}`,
        groupId: `group-${Date.now()}`,
        kind: 'pasteNodes',
        issuedAt: Date.now(),
      });
      
      if (result.success && result.newNodeIds) {
        return { success: true, nodeIds: result.newNodeIds } as const;
      }
      return { success: false, error: 'Paste failed' } as const;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Import from Template - Orchestrated API
   * 
   * Imports pre-defined template data into the tree
   * 
   * @param params Template import parameters
   * @returns Promise with imported node IDs and status
   */
  async importFromTemplate(params: {
    templateId: string;
    targetParentId: TreeNodeId;
  }): Promise<{ success: boolean; nodeIds?: TreeNodeId[]; error?: string }> {
    try {
      const importService = new ImportService(this.coreDB, this.mutationService);
      const result = await importService.importFromTemplate({
        templateId: params.templateId,
        targetParentId: params.targetParentId,
      });
      
      return {
        success: result.success,
        nodeIds: result.importedNodeIds,
        error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Import from File - Orchestrated API
   * 
   * Imports tree data from uploaded file (JSON/ZIP)
   * 
   * @param params File import parameters
   * @returns Promise with imported node IDs and status
   */
  async importFromFile(params: {
    file: File;
    targetParentId: TreeNodeId;
  }): Promise<{ success: boolean; nodeIds?: TreeNodeId[]; error?: string }> {
    try {
      const importService = new ImportService(this.coreDB, this.mutationService);
      const result = await importService.importFromFile({
        file: params.file,
        targetParentId: params.targetParentId,
      });
      
      return {
        success: result.success,
        nodeIds: result.importedNodeIds,
        error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Export Tree Nodes - Orchestrated API
   * 
   * Exports selected nodes to JSON/ZIP format
   * Note: This is a new orchestrated method that doesn't conflict with the base exportNodes
   * 
   * @param params Export parameters
   * @returns Promise with export blob and status
   */
  async exportTreeNodes(params: {
    nodeIds: TreeNodeId[];
    format?: 'json' | 'zip';
  }): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      const exportService = new ExportService(this.coreDB, this.queryService);
      
      const result = params.format === 'zip' 
        ? await exportService.exportToZIP({ nodeIds: params.nodeIds })
        : await exportService.exportToJSON({ nodeIds: params.nodeIds });
      
      return {
        success: result.success,
        blob: result.blob,
        filename: ExportService.generateFileName('hierarchidb-export'),
        error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  // Plugin Registry API methods
  
  /**
   * Get all registered plugins
   */
  async getRegisteredPlugins(): Promise<any[]> {
    return getRegisteredPlugins();
  }

  /**
   * Get a specific plugin definition
   */
  async getPluginDefinition(nodeType: string): Promise<any | null> {
    return getPluginDefinition(nodeType);
  }

  /**
   * Check if a node type is registered
   */
  async isNodeTypeRegistered(nodeType: string): Promise<boolean> {
    return isNodeTypeRegistered(nodeType);
  }

  /**
   * Get creatable node types
   */
  async getCreatableNodeTypes(): Promise<string[]> {
    return getCreatableNodeTypes();
  }
}
