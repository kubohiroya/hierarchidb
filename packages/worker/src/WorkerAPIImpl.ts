import type { WorkerAPI } from '@hierarchidb/api';
import type { Observable } from 'rxjs';
import type {
  CommandEnvelope,
  CommandResult as CoreCommandResult,
  Tree,
  TreeId,
  TreeNodeId,
  TreeNode,
  TreeChangeEvent,
  ExpandedStateChanges,
  SubTreeChanges,
  ObserveNodePayload,
  ObserveChildrenPayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
  GetNodePayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetAncestorsPayload,
  SearchNodesPayload,
  CopyNodesPayload,
  ExportNodesPayload,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  MoveNodesPayload,
  DuplicateNodesPayload,
  PasteNodesPayload,
  MoveToTrashPayload,
  PermanentDeletePayload,
  RecoverFromTrashPayload,
  ImportNodesPayload,
  UndoPayload,
  RedoPayload,
} from '@hierarchidb/core';
import type { CommandResult } from './command/types';
import { CoreDB } from './db/CoreDB';
import { EphemeralDB } from './db/EphemeralDB';
import { TreeQueryServiceImpl } from './services/TreeQueryServiceImpl';
import { TreeMutationServiceImpl } from './services/TreeMutationServiceImpl';
import { TreeObservableServiceImpl } from './services/TreeObservableServiceImpl';
import { CommandProcessor } from './command/CommandProcessor';
import { SimpleNodeTypeRegistry } from './registry/SimpleNodeTypeRegistry';
import { NodeLifecycleManager } from './lifecycle/NodeLifecycleManager';

export class WorkerAPIImpl implements WorkerAPI {
  private coreDB: CoreDB;
  private ephemeralDB: EphemeralDB;
  private queryService: TreeQueryServiceImpl;
  private mutationService: TreeMutationServiceImpl;
  private observableService: TreeObservableServiceImpl;
  private commandProcessor: CommandProcessor;
  private nodeTypeRegistry: SimpleNodeTypeRegistry;
  private nodeLifecycleManager: NodeLifecycleManager;

  constructor(dbName: string) {
    this.coreDB = new CoreDB(dbName);
    this.ephemeralDB = new EphemeralDB(dbName);

    this.commandProcessor = new CommandProcessor();
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
    await Promise.all([
      this.coreDB.initialize(),
      this.ephemeralDB.initialize()
    ]);
  }

  async dispose(): Promise<void> {
    this.coreDB.close();
    this.ephemeralDB.close();
  }

  async getTree(params: { treeId: TreeId }): Promise<Tree | undefined> {
    return this.coreDB.getTree(params.treeId);
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
  async copyNodes(payload: CopyNodesPayload): Promise<CoreCommandResult> {
    return this.queryService.copyNodes(payload);
  }

  async exportNodes(payload: ExportNodesPayload): Promise<CoreCommandResult> {
    return this.queryService.exportNodes(payload);
  }

  // TreeMutationService methods
  async createWorkingCopyForCreate(
    cmd: CommandEnvelope<'createWorkingCopyForCreate', CreateWorkingCopyForCreatePayload>
  ): Promise<void> {
    return this.mutationService.createWorkingCopyForCreate(cmd);
  }

  async createWorkingCopy(
    cmd: CommandEnvelope<'createWorkingCopy', CreateWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.createWorkingCopy(cmd);
  }

  async discardWorkingCopyForCreate(
    cmd: CommandEnvelope<'discardWorkingCopyForCreate', DiscardWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.discardWorkingCopyForCreate(cmd);
  }

  async discardWorkingCopy(
    cmd: CommandEnvelope<'discardWorkingCopy', DiscardWorkingCopyPayload>
  ): Promise<void> {
    return this.mutationService.discardWorkingCopy(cmd);
  }

  async commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.commitWorkingCopyForCreate(cmd);
  }

  async commitWorkingCopy(
    cmd: CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.commitWorkingCopy(cmd);
  }

  async moveNodes(cmd: CommandEnvelope<'moveNodes', MoveNodesPayload>): Promise<CoreCommandResult> {
    return this.mutationService.moveNodes(cmd);
  }

  async duplicateNodes(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.duplicateNodes(cmd);
  }

  async pasteNodes(
    cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.pasteNodes(cmd);
  }

  async moveToTrash(
    cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.moveToTrash(cmd);
  }

  async permanentDelete(
    cmd: CommandEnvelope<'permanentDelete', PermanentDeletePayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.permanentDelete(cmd);
  }

  async recoverFromTrash(
    cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.recoverFromTrash(cmd);
  }

  async importNodes(
    cmd: CommandEnvelope<'importNodes', ImportNodesPayload>
  ): Promise<CoreCommandResult> {
    return this.mutationService.importNodes(cmd);
  }

  async undo(cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
    // Use CommandProcessor for undo
    const result = await this.commandProcessor.undo();
    return this.convertToCommandResult(result);
  }

  async redo(cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
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
      } as any;
      if (result.nodeId) {
        (successResult as any).nodeId = result.nodeId;
      }
      if (result.newNodeIds) {
        (successResult as any).newNodeIds = result.newNodeIds;
      }
      return successResult;
    } else {
      const errorResult: CoreCommandResult = {
        success: false,
        error: result.error,
        code: result.code as any,
      } as any;
      if (result.seq !== undefined) {
        (errorResult as any).seq = result.seq;
      }
      return errorResult;
    }
  }

  // TreeObservableService methods
  async subscribeSubTree(
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

  async toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void> {
    return this.observableService.toggleNodeExpanded(pageTreeNodeId);
  }

  async listChildren(parentId: TreeNodeId, doExpandNode?: boolean): Promise<SubTreeChanges> {
    return this.observableService.listChildren(parentId, doExpandNode);
  }

  async getNodeAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]> {
    return this.observableService.getNodeAncestors(pageNodeId);
  }

  async searchByNameWithDepth(
    rootNodeId: TreeNodeId,
    query: string,
    opts: {
      maxDepth: number;
      maxVisited?: number;
    }
  ): Promise<TreeNode[]> {
    return this.observableService.searchByNameWithDepth(rootNodeId, query, opts);
  }

  // Observable methods
  async observeNode(
    cmd: CommandEnvelope<'observeNode', ObserveNodePayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeNode(cmd);
  }

  async observeChildren(
    cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeChildren(cmd);
  }

  async observeSubtree(
    cmd: CommandEnvelope<'observeSubtree', ObserveSubtreePayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeSubtree(cmd);
  }

  async observeWorkingCopies(
    cmd: CommandEnvelope<'observeWorkingCopies', ObserveWorkingCopiesPayload>
  ): Promise<Observable<TreeChangeEvent>> {
    return this.observableService.observeWorkingCopies(cmd);
  }

  // Query service overrides
  async getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]> {
    return this.queryService.getAncestors(payload);
  }

  // Observable service management
  async getActiveSubscriptions(): Promise<number> {
    return this.observableService.getActiveSubscriptions();
  }

  async cleanupOrphanedSubscriptions(): Promise<void> {
    return this.observableService.cleanupOrphanedSubscriptions();
  }

  // Query service methods
  async getNode(payload: GetNodePayload): Promise<TreeNode | undefined> {
    return this.queryService.getNode(payload);
  }

  async getChildren(payload: GetChildrenPayload): Promise<TreeNode[]> {
    return this.queryService.getChildren(payload);
  }

  async getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]> {
    return this.queryService.getDescendants(payload);
  }

  async searchNodes(payload: SearchNodesPayload): Promise<TreeNode[]> {
    return this.queryService.searchNodes(payload);
  }
}
