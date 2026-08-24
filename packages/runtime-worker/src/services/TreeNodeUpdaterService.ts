import type {
  NodeId,
  NodeType,
  PeerEntity,
  TreeId,
  ValidationResult,
} from '@hierarchidb/core-types';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';
import type { TagAPI } from '@hierarchidb/tag-api';
import type {
  CommitDraftMode,
  CommitDraftRequest,
  CommitResult,
  DialogUIState,
  DiscardDraftOptions,
  OnNameConflict,
  TreeNode,
  TreeNodeData,
  TreeNodeMetadata,
  TreeNodeUpdaterAPI,
  ViewProperties,
} from '@hierarchidb/tree-api';
import { resolveDefaultNodeName } from '~/utils/resolveDefaultNodeName';
import type { CommandProcessor } from './CommandProcessor.js';
import type { CoreDB } from './CoreDB.js';
import {
  commitDraft as commitDraftOp,
  discardDraft as discardWc,
  getTreeNode,
  initTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from './DraftTreeNodeOperations.js';
import {
  assertNodeIsNotTemporaryStagingNode,
  isNodeInTemporaryFolderSubtree,
} from './temporaryFolderHolderLifecycle.js';

interface YamlCanonicalDialogWriteRequest {
  readonly nodeId: NodeId;
  readonly mode: 'save-draft' | 'save';
  readonly draftMetadata: Readonly<{
    readonly name: string;
    readonly description: string;
    readonly tags: readonly string[];
  }>;
  readonly draftData: Readonly<Record<string, unknown>>;
  readonly onNameConflict: 'error';
}

export type YamlCanonicalDialogWriter = (
  input: unknown,
  writePort: (request: YamlCanonicalDialogWriteRequest) => Promise<void>
) => Promise<
  Readonly<{ readonly ok: boolean; readonly error?: Readonly<{ readonly code: string }> }>
>;

interface YamlCanonicalDialogInput {
  readonly writerInput: Readonly<Record<string, unknown>>;
  readonly dialogUIState: DialogUIState | null;
}

function readOwnDataProperty(
  value: object,
  key: PropertyKey
): Readonly<{ readonly ok: true; readonly value: unknown }> | Readonly<{ readonly ok: false }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? Object.freeze({ ok: true, value: descriptor.value })
      : Object.freeze({ ok: false });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function hasExactOwnKeys(value: unknown, expectedKeys: readonly string[]): value is object {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    const ownKeys = Reflect.ownKeys(value);
    return (
      (prototype === Object.prototype || prototype === null) &&
      ownKeys.length === expectedKeys.length &&
      ownKeys.every((key) => typeof key === 'string' && expectedKeys.includes(key))
    );
  } catch {
    return false;
  }
}

function isPlainOwnDataRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return (
      (prototype === Object.prototype || prototype === null) &&
      Reflect.ownKeys(value).every((key) => {
        if (typeof key !== 'string') return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor !== undefined && Object.hasOwn(descriptor, 'value');
      })
    );
  } catch {
    return false;
  }
}

function createYamlCanonicalDialogInput(
  nodeId: NodeId,
  request: CommitDraftRequest<TreeNodeData> | undefined
): YamlCanonicalDialogInput | null {
  if (!hasExactOwnKeys(request, ['draftMetadata', 'draftData', 'dialogUIState', 'mode'])) {
    return null;
  }
  const draftMetadata = readOwnDataProperty(request, 'draftMetadata');
  const draftData = readOwnDataProperty(request, 'draftData');
  const dialogUIState = readOwnDataProperty(request, 'dialogUIState');
  const mode = readOwnDataProperty(request, 'mode');
  if (
    !draftMetadata.ok ||
    !draftData.ok ||
    !dialogUIState.ok ||
    !mode.ok ||
    (mode.value !== 'save' && mode.value !== 'save-draft') ||
    (dialogUIState.value !== null && !isPlainOwnDataRecord(dialogUIState.value)) ||
    !hasExactOwnKeys(draftMetadata.value, ['name', 'description', 'tags'])
  ) {
    return null;
  }
  const name = readOwnDataProperty(draftMetadata.value, 'name');
  const description = readOwnDataProperty(draftMetadata.value, 'description');
  const tags = readOwnDataProperty(draftMetadata.value, 'tags');
  if (!name.ok || !description.ok || !tags.ok) return null;
  return Object.freeze({
    writerInput: Object.freeze({
      nodeId,
      mode: mode.value,
      filename: name.value,
      description: description.value,
      tags: tags.value,
      payload: draftData.value,
    }),
    dialogUIState: dialogUIState.value as DialogUIState | null,
  });
}

/**
 * DraftService - minimal implementation backed by CoreDB TreeNodes.
 * Note: This service returns only serializable data. It does not expose ProxyMarked types.
 */
export class TreeNodeUpdaterService implements TreeNodeUpdaterAPI<TreeNodeData> {
  constructor(
    private coreDB: CoreDB,
    _commandProcessor?: CommandProcessor,
    private tagService?: TagAPI,
    private yamlCanonicalDialogWriter?: YamlCanonicalDialogWriter
  ) {}

  private readonly defaultDialogUIState: DialogUIState = {
    dialogWindow: null,
    dialogProgress: {
      activeStepIndex: 1,
    },
  };

  /**
   * Returns a copy of the node normalized for TreeNodeUpdaterAPI consumers:
   * - draftMetadata: never null (falls back to metadata/default)
   * - draftData: uses draftData when available, otherwise empty for known types
   * - dialogUIState: never null (uses stored or default)
   *
   * Does NOT persist changes; QueryAPI/SubscriptionAPI are untouched.
   */
  private normalizeForUpdater(node?: TreeNode, fallbackName?: string): TreeNode | undefined {
    if (!node) return undefined;
    type EmptyTreeNodeData = TreeNodeData;
    const emptyDraftDataByType: Record<string, EmptyTreeNodeData> = {
      folder: {},
    };
    const metadata = (node as { metadata?: TreeNodeMetadata | null }).metadata ?? {
      name: fallbackName ?? resolveDefaultNodeName(node.nodeType as NodeType),
      description: '',
      tags: [],
    };
    const draftMetadata = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? {
      ...metadata,
    };
    const draftDataVal = (node as { draftData?: unknown }).draftData;
    let draftData: Record<string, unknown> | undefined;
    if (draftDataVal && typeof draftDataVal === 'object') {
      draftData = { ...(draftDataVal as Record<string, unknown>) };
    } else if (node.nodeType in emptyDraftDataByType) {
      draftData = { ...emptyDraftDataByType[node.nodeType] };
    }
    const dialogUIState =
      (node as { dialogUIState?: DialogUIState | null }).dialogUIState ?? this.defaultDialogUIState;

    return {
      ...(node as TreeNode),
      draftMetadata,
      draftData,
      dialogUIState,
    };
  }

  private cloneDraftData<T extends Record<string, unknown>>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return { ...value };
    }
  }

  private resolveDefaultDraftData(nodeType: NodeType): Record<string, unknown> | undefined {
    if (nodeType === 'shape') {
      return {
        buildConfig: DEFAULT_BUILD_CONFIG,
        processingConfig: DEFAULT_PROCESSING_CONFIG,
      };
    }
    return undefined;
  }

  private normalizeTagNames(tags: string[]): string[] {
    const normalized = new Map<string, string>();
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!normalized.has(key)) {
        normalized.set(key, trimmed);
      }
    }
    return Array.from(normalized.values());
  }

  private pickTagColor(name: string): string {
    const palette = [
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#009688',
      '#4caf50',
      '#ff9800',
      '#795548',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % palette.length;
    return palette[idx] ?? '#9e9e9e';
  }

  private async syncTagsForNode(
    nodeId: NodeId,
    tags: string[],
    scope: 'draft' | 'published'
  ): Promise<void> {
    if (!this.tagService) return;
    const desired = this.normalizeTagNames(tags);
    const desiredKeys = new Set(desired.map((tag) => tag.toLowerCase()));

    const [allTags, existingTags] = await Promise.all([
      this.tagService.getAllTags(),
      this.tagService.getTagAssociationsForNode(nodeId),
    ]);

    const allByName = new Map(allTags.map((tag) => [tag.name.trim().toLowerCase(), tag] as const));
    const existingByName = new Map(
      existingTags
        .filter((assoc) => assoc.scope === scope)
        .map((assoc) => {
          const tag = allTags.find((t) => t.id === assoc.tagId);
          if (!tag) return null;
          return [tag.name.trim().toLowerCase(), tag] as const;
        })
        .filter((entry): entry is readonly [string, (typeof allTags)[number]] => Boolean(entry))
    );

    for (const name of desired) {
      const key = name.toLowerCase();
      let tag = existingByName.get(key) ?? allByName.get(key);
      if (!tag) {
        tag = await this.tagService.createTag({
          name,
          color: this.pickTagColor(name),
        });
        allByName.set(key, tag);
      }
      await this.tagService.addTagToNode({ nodeId, tagId: tag.id, scope });
    }

    for (const assoc of existingTags.filter((entry) => entry.scope === scope)) {
      const tag = allTags.find((t) => t.id === assoc.tagId);
      if (!tag) continue;
      const key = tag.name.trim().toLowerCase();
      if (!desiredKeys.has(key)) {
        await this.tagService.removeTagFromNode({ nodeId, tagId: tag.id, scope });
      }
    }
  }

  private async clearTagScope(nodeId: NodeId, scope: 'draft' | 'published'): Promise<void> {
    if (!this.tagService) return;
    const associations = await this.tagService.getTagAssociationsForNode(nodeId);
    for (const assoc of associations) {
      if (assoc.scope !== scope) continue;
      await this.tagService.removeTagFromNode({
        nodeId,
        tagId: assoc.tagId,
        scope,
      });
    }
  }

  private async ensureDraftData(
    node?: TreeNode,
    persist: boolean = false
  ): Promise<TreeNode | undefined> {
    if (!node) return undefined;
    const draftDataVal = (node as { draftData?: unknown }).draftData;
    if (typeof draftDataVal !== 'undefined') {
      return node;
    }
    const dataVal = (node as { data?: unknown }).data;
    let nextDraftData: Record<string, unknown> | undefined;
    if (dataVal && typeof dataVal === 'object') {
      nextDraftData = this.cloneDraftData(dataVal as Record<string, unknown>);
    } else {
      const defaults = this.resolveDefaultDraftData(node.nodeType as NodeType);
      if (defaults) {
        nextDraftData = this.cloneDraftData(defaults);
      }
    }
    if (!nextDraftData) return node;
    if (persist) {
      await this.coreDB.nodes.update(node.id as NodeId, {
        draftData: nextDraftData,
      });
      const refreshed = await this.coreDB.nodes.get(node.id);
      return refreshed as TreeNode | undefined;
    }
    return {
      ...node,
      draftData: nextDraftData,
    } as TreeNode;
  }

  private async ensureDraftMetadata(
    node?: TreeNode,
    fallbackName?: string,
    persist: boolean = false
  ): Promise<TreeNode | undefined> {
    if (!node) return undefined;
    const draftMeta = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? null;
    if (draftMeta !== null) {
      return node;
    }
    const base = (node as { metadata?: TreeNodeMetadata | null }).metadata ?? {
      name: fallbackName ?? resolveDefaultNodeName(node.nodeType as NodeType),
      description: '',
      tags: [],
    };
    if (persist) {
      await this.coreDB.nodes.update(node.id as NodeId, {
        draftMetadata: base,
      });
      const refreshed = await this.coreDB.nodes.get(node.id);
      return refreshed as TreeNode | undefined;
    }
    return {
      ...node,
      draftMetadata: base,
    } as TreeNode;
  }

  private async ensureDialogUIState(
    node?: TreeNode,
    persist: boolean = false
  ): Promise<TreeNode | undefined> {
    if (!node) return undefined;
    const current = (node as { dialogUIState?: DialogUIState | null }).dialogUIState ?? null;
    if (current && current.dialogWindow && current.dialogProgress) {
      return node;
    }
    const fallback: DialogUIState = {
      dialogWindow: current?.dialogWindow ?? null,
      dialogProgress: {
        activeStepIndex: current?.dialogProgress?.activeStepIndex ?? 1,
      },
    };
    if (persist) {
      await this.coreDB.nodes.update(node.id as NodeId, { dialogUIState: current ?? fallback });
      const refreshed = await this.coreDB.nodes.get(node.id);
      return refreshed as TreeNode | undefined;
    }
    return {
      ...node,
      dialogUIState: current ?? fallback,
    } as TreeNode;
  }

  async initTreeNode(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode> {
    const treeId = parentId.split(':')[0] as TreeId;
    const desiredName =
      (initialData as { metadata?: { name?: string } } | undefined)?.metadata?.name?.trim() ||
      resolveDefaultNodeName(nodeType);
    const resolvedInitial = (() => {
      const initialDraftData = (initialData as { draftData?: unknown } | undefined)?.draftData;
      if (typeof initialDraftData !== 'undefined') return initialData;
      const defaults = this.resolveDefaultDraftData(nodeType);
      if (!defaults) return initialData;
      return {
        ...(initialData ?? {}),
        draftData: this.cloneDraftData(defaults),
      };
    })();

    const wcNodeId = await initTreeNode(
      this.coreDB,
      treeId,
      parentId,
      nodeType,
      desiredName,
      (initialData as { id?: NodeId } | undefined)?.id,
      resolvedInitial
    );
    const wc = await this.coreDB.nodes.get(wcNodeId);
    if (!wc) throw new Error('Working copy creation failed');
    // Ensure draftMetadata is always present; for edit mode seed from metadata when absent.
    const hasDraftMeta =
      (wc as { draftMetadata?: unknown }).draftMetadata !== null &&
      typeof (wc as { draftMetadata?: unknown }).draftMetadata !== 'undefined';
    if (!hasDraftMeta) {
      await this.coreDB.nodes.update(wcNodeId, {
        draftMetadata: {
          ...((wc as { metadata?: TreeNode['metadata'] }).metadata ?? {
            name: desiredName,
            description: '',
            tags: [],
          }),
          ...(initialData?.draftMetadata ?? initialData?.metadata ?? {}),
        },
      });
      const refreshed = (await this.coreDB.nodes.get(wcNodeId)) ?? undefined;
      const withMeta = await this.ensureDraftMetadata(refreshed, desiredName, true);
      const withUi = await this.ensureDialogUIState(withMeta ?? refreshed, true);
      return (withUi ?? withMeta ?? refreshed)!;
    }
    const withMeta = await this.ensureDraftMetadata(wc ?? undefined, desiredName, true);
    const withUi = await this.ensureDialogUIState(withMeta ?? wc ?? undefined, true);
    return (withUi ?? withMeta ?? wc)!;
  }

  async getTreeNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (!node) return undefined;
    const withMeta = await this.ensureDraftMetadata(node ?? undefined, undefined, false);
    const withDraft = await this.ensureDraftData(withMeta ?? node ?? undefined, false);
    const withUi = await this.ensureDialogUIState(
      withDraft ?? withMeta ?? node ?? undefined,
      false
    );
    return this.normalizeForUpdater(withUi ?? withDraft ?? withMeta ?? node ?? undefined);
  }

  // createDraftFromNode / getDraft / updateDraft are removed in favor of QueryAPI + updater calls.

  async updateTreeNodeDraftMetadata(
    nodeId: NodeId,
    updater: Partial<TreeNodeMetadata> | null
  ): Promise<void> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (node?.nodeType === 'yaml-file') {
      throw new Error('yaml-canonical-dialog-update-required');
    }
    await updateTreeNodeDraftMetadata(this.coreDB, nodeId, updater);
  }

  async updateTreeNodeDraftData(
    nodeId: NodeId,
    updater: Partial<PeerEntity<TreeNodeData>>
  ): Promise<void> {
    const node = await this.coreDB.nodes.get(nodeId);
    if (node?.nodeType === 'yaml-file') {
      throw new Error('yaml-canonical-dialog-update-required');
    }
    await updateTreeNodeDraftData(this.coreDB, nodeId, updater);
  }

  async listDrafts(): Promise<TreeNode[]> {
    // Drafts are nodes with draftData present
    const allNodes = await this.coreDB.nodes.toArray();
    const drafts: TreeNode[] = [];
    for (const node of allNodes) {
      if (
        node.draftData !== undefined &&
        !(await isNodeInTemporaryFolderSubtree(this.coreDB, node.id as NodeId))
      ) {
        drafts.push(node);
      }
    }
    return drafts;
  }

  async hasDraft(nodeId: NodeId): Promise<boolean> {
    if (await isNodeInTemporaryFolderSubtree(this.coreDB, nodeId)) return false;
    const wc = await getTreeNode(this.coreDB, nodeId);
    return !!wc;
  }

  async updateTreeNode(
    draftId: NodeId,
    request?: CommitDraftRequest<TreeNodeData>
  ): Promise<CommitResult> {
    const node = await this.coreDB.nodes.get(draftId);
    if (node?.nodeType === 'yaml-file') {
      const input = createYamlCanonicalDialogInput(draftId, request);
      if (input === null || this.yamlCanonicalDialogWriter === undefined) {
        throw new Error('yaml-canonical-dialog-write-rejected:INVALID_INPUT');
      }
      let commitResult: CommitResult | null = null;
      const writerResult = await this.yamlCanonicalDialogWriter(
        input.writerInput,
        async (canonicalRequest) => {
          if (canonicalRequest.nodeId !== draftId) {
            throw new Error('yaml-canonical-dialog-node-id-mismatch');
          }
          commitResult = await this.updateTreeNodeUnchecked(draftId, {
            mode: canonicalRequest.mode,
            draftMetadata: {
              name: canonicalRequest.draftMetadata.name,
              description: canonicalRequest.draftMetadata.description,
              tags: [...canonicalRequest.draftMetadata.tags],
            },
            draftData: canonicalRequest.draftData,
            dialogUIState: input.dialogUIState,
            onNameConflict: canonicalRequest.onNameConflict,
          });
        }
      );
      if (!writerResult.ok) {
        throw new Error(
          `yaml-canonical-dialog-write-rejected:${writerResult.error?.code ?? 'UNKNOWN'}`
        );
      }
      if (commitResult === null) {
        throw new Error('yaml-canonical-dialog-write-rejected:WRITE_PORT_FAILED');
      }
      return commitResult;
    }
    return await this.updateTreeNodeUnchecked(draftId, request);
  }

  private async updateTreeNodeUnchecked(
    draftId: NodeId,
    request?: CommitDraftRequest<TreeNodeData>
  ): Promise<CommitResult> {
    await assertNodeIsNotTemporaryStagingNode(this.coreDB, draftId);
    const conflictPolicy: OnNameConflict = request?.onNameConflict ?? 'error';
    const mode: CommitDraftMode = request?.mode ?? 'save';

    const updates: Partial<TreeNode> = {};
    if (mode === 'save' || mode === 'save-draft') {
      updates.isTemporary = false;
    }
    if ('draftMetadata' in (request ?? {})) {
      updates.draftMetadata = (request?.draftMetadata ?? null) as TreeNodeMetadata | null;
    }
    if ('draftData' in (request ?? {})) {
      updates.draftData = request?.draftData ?? undefined;
    }
    if ('dialogUIState' in (request ?? {})) {
      updates.dialogUIState = request?.dialogUIState ?? undefined;
    }
    if ('data' in (request ?? {})) {
      updates.data = request?.data ?? null;
    }
    if ('metadata' in (request ?? {})) {
      updates.metadata = (request?.metadata ?? undefined) as TreeNodeMetadata | undefined;
    }
    if (Object.keys(updates).length > 0) {
      const previousNode = await this.coreDB.getNode(draftId);
      await this.coreDB.nodes.update(draftId, updates);
      const nextNode = await this.coreDB.getNode(draftId);
      if (nextNode) {
        this.coreDB.changeSubject.next({
          type: 'node-updated',
          nodeId: draftId,
          node: nextNode,
          previousNode: previousNode ?? undefined,
          parentId: nextNode.parentId,
          previousParentId: previousNode?.parentId,
          timestamp: Date.now(),
        });
      }
    }
    const shouldLogDebug =
      typeof console !== 'undefined' &&
      typeof console.debug === 'function' &&
      !(globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean }).__HDB_SILENCE_WORKER_LOGS__;
    // Ensure dialogUIState is persisted when provided (save-draft path often depends on it).
    if (request?.dialogUIState) {
      await this.coreDB.nodes.update(draftId, { dialogUIState: request.dialogUIState });
    }

    if (shouldLogDebug) {
      console.debug('[DraftService] commitDraft request', {
        draftId,
        conflictPolicy,
        mode,
      });
    }

    if (mode === 'save-draft') {
      const requestedName = request?.draftMetadata?.name;
      const requestedTags = Array.isArray(request?.draftMetadata?.tags)
        ? (request?.draftMetadata?.tags ?? [])
        : [];
      let nodeMaybe: TreeNode | undefined = (await getTreeNode(this.coreDB, draftId)) ?? undefined;
      nodeMaybe =
        (await this.ensureDraftMetadata(nodeMaybe ?? undefined, requestedName, true)) ??
        nodeMaybe ??
        undefined;
      nodeMaybe =
        (await this.ensureDialogUIState(nodeMaybe ?? undefined, false)) ?? nodeMaybe ?? undefined;
      const node = this.normalizeForUpdater(nodeMaybe ?? undefined, requestedName);
      if (shouldLogDebug) {
        const draftMeta = (node as { draftMetadata?: TreeNodeMetadata | null })?.draftMetadata;
        const dialogUIState = (node as { dialogUIState?: DialogUIState | null })?.dialogUIState;
        console.debug('[DraftService] commitDraft save-draft result', {
          nodeId: draftId,
          persistedNode: node
            ? {
                id: node.id,
                metadata: node.metadata,
                draftMetadata: draftMeta,
                dialogUIState,
              }
            : null,
        });
      }
      if (this.tagService) {
        await this.syncTagsForNode(draftId, requestedTags, 'draft');
      }
      return { status: 'ok', nodeId: draftId, node: node as TreeNode | undefined };
    }

    const result = await commitDraftOp(this.coreDB, draftId, conflictPolicy);
    if (shouldLogDebug) {
      const requestedName = request?.draftMetadata?.name;
      let nodeMaybe: TreeNode | undefined =
        result.status === 'ok'
          ? ((await getTreeNode(this.coreDB, result.nodeId as NodeId)) ?? undefined)
          : undefined;
      nodeMaybe =
        (await this.ensureDraftMetadata(nodeMaybe ?? undefined, requestedName, true)) ??
        nodeMaybe ??
        undefined;
      nodeMaybe =
        (await this.ensureDialogUIState(nodeMaybe ?? undefined, false)) ?? nodeMaybe ?? undefined;
      const node = this.normalizeForUpdater(nodeMaybe ?? undefined, requestedName);
      const draftMeta = (node as { draftMetadata?: TreeNodeMetadata | null })?.draftMetadata;
      console.debug('[DraftService] commitDraft result', {
        status: result.status,
        nodeId: result.status === 'ok' ? result.nodeId : undefined,
        autoRenameTo: 'autoRenameTo' in result ? result.autoRenameTo : undefined,
        suggestedName: result.status === 'NAME_CONFLICT' ? result.suggestedName : undefined,
        originalVersion: result.status === 'COMMIT_CONFLICT' ? result.originalVersion : undefined,
        wcVersion: result.status === 'COMMIT_CONFLICT' ? result.wcVersion : undefined,
        persistedNode: node
          ? {
              id: node.id,
              metadata: node.metadata,
              draftMetadata: draftMeta,
            }
          : null,
      });
    }
    if (result.status === 'ok') {
      const requestedName = request?.draftMetadata?.name;
      const normalizedNode =
        (await this.ensureDraftMetadata(
          (result.node as TreeNode | undefined) ??
            ((await getTreeNode(this.coreDB, result.nodeId as NodeId)) as TreeNode | undefined),
          requestedName,
          true
        )) ?? (result.node as TreeNode | undefined);
      const withUi =
        (await this.ensureDialogUIState(normalizedNode ?? undefined, false)) ?? normalizedNode;
      const forUpdater = this.normalizeForUpdater(withUi ?? undefined, requestedName);
      const metadataTags = Array.isArray(forUpdater?.metadata?.tags)
        ? (forUpdater?.metadata?.tags ?? [])
        : [];
      if (this.tagService) {
        await this.syncTagsForNode(result.nodeId, metadataTags, 'published');
        await this.clearTagScope(result.nodeId, 'draft');
      }
      return {
        status: 'ok',
        nodeId: result.nodeId,
        autoRenameTo: result.autoRenameTo,
        node: forUpdater ?? undefined,
      };
    }
    if (result.status === 'NAME_CONFLICT') {
      return {
        status: 'NAME_CONFLICT',
        suggestedName: result.suggestedName,
      };
    }
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: result.originalVersion,
      wcVersion: result.wcVersion,
    };
  }

  /** @deprecated use updateTreeNode */
  async commitDraft(
    draftId: NodeId,
    request?: CommitDraftRequest<TreeNodeData>
  ): Promise<CommitResult> {
    return this.updateTreeNode(draftId, request);
  }

  async discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void> {
    await assertNodeIsNotTemporaryStagingNode(this.coreDB, nodeId);
    const wc = await getTreeNode(this.coreDB, nodeId);
    if (!wc) return;
    await discardWc(this.coreDB, nodeId, options);
    await this.clearTagScope(nodeId, 'draft');
  }

  async discardAllDrafts(): Promise<number> {
    const list = await this.listDrafts();
    for (const wc of list) {
      await discardWc(this.coreDB, wc.id as NodeId, { forceDelete: true });
      await this.clearTagScope(wc.id as NodeId, 'draft');
    }
    return list.length;
  }

  async validateDraft(nodeId: NodeId): Promise<ValidationResult> {
    const exists = await getTreeNode(this.coreDB, nodeId);
    return exists ? { valid: true } : { valid: false, message: 'Working copy not found' };
  }

  async hasUnsavedChanges(nodeId: NodeId): Promise<boolean> {
    return !!(await getTreeNode(this.coreDB, nodeId));
  }

  async getDraftStats(): Promise<{
    total: number;
    drafts: number;
    edits: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    const list = await this.listDrafts();
    const now = Date.now();
    return {
      total: list.length,
      drafts: list.length,
      edits: list.length,
      oldestTimestamp: list.reduce((min, x) => Math.min(min, x.updatedAt), now),
      newestTimestamp: list.reduce((max, x) => Math.max(max, x.updatedAt), 0),
    };
  }

  async cleanupOldDrafts(olderThan: number): Promise<number> {
    const list = await this.listDrafts();
    const toDelete = list.filter((x) => x.updatedAt < olderThan);
    for (const wc of toDelete) {
      await discardWc(this.coreDB, wc.id as NodeId, { forceDelete: true });
      await this.clearTagScope(wc.id as NodeId, 'draft');
    }
    return toDelete.length;
  }

  async updateViewProperties(nodeId: NodeId, viewProperties: ViewProperties): Promise<void> {
    const previousNode = await this.coreDB.getNode(nodeId);
    await this.coreDB.nodes.update(nodeId, { viewProperties });
    const nextNode = await this.coreDB.getNode(nodeId);
    if (nextNode) {
      this.coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId,
        node: nextNode,
        previousNode: previousNode ?? undefined,
        parentId: nextNode.parentId,
        previousParentId: previousNode?.parentId,
        timestamp: Date.now(),
      });
    }
  }
}
