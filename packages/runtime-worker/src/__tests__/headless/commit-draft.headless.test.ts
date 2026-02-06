import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, NodeType, PeerEntity, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeData, TreeNodeMetadata } from '@hierarchidb/tree-api';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';
import { TreeNodeUpdaterService } from '../../services/TreeNodeUpdaterService.js';
import {
  assertCommitConflict,
  assertCommitNameConflict,
  assertCommitOk,
} from '../../test-utils/assertions.js';

describe('Draft commit E2E (holder-less)', () => {
  let core: CoreDB;
  let cp: CommandProcessor;
  let draftService: TreeNodeUpdaterService;

  beforeEach(async () => {
    core = await CoreDB.getSingleton('e2e-db');
    cp = new CommandProcessor(core);
    draftService = new TreeNodeUpdaterService(core, cp);
  });

  async function createDraftNode(params: {
    nodeType: NodeType;
    parentId: NodeId;
    metadata?: Partial<TreeNodeMetadata>;
    draftData?: Partial<PeerEntity<TreeNodeData>>;
  }): Promise<TreeNode> {
    const draftNode = await draftService.initTreeNode(params.nodeType, params.parentId, {
      metadata: params.metadata as TreeNode['metadata'],
      draftData: params.draftData as TreeNode['draftData'],
    } as Partial<TreeNode>);
    if (params.metadata) {
      await draftService.updateTreeNodeDraftMetadata(draftNode.id as NodeId, params.metadata);
    }
    if (params.draftData) {
      await draftService.updateTreeNodeDraftData(draftNode.id as NodeId, params.draftData);
    }
    const reloaded = await core.nodes.get(draftNode.id as NodeId);
    if (!reloaded) throw new Error('draft node not found');
    return reloaded as TreeNode;
  }

  it('preserves draftData content when committing a non-folder node (basemap)', async () => {
    const parentId = 'r:root' as NodeId;
    const draftPayload = {
      mapStyle: { style: 'streets' },
      viewport: { center: [0, 0] as [number, number], zoom: 2, bearing: 0, pitch: 0 },
    };

    const draft = await createDraftNode({
      nodeType: 'basemap' as NodeType,
      parentId,
      metadata: { name: uniqueName('Basemap') },
      draftData: draftPayload,
    });

    const commitResult = await draftService.commitDraft(draft.id);
    assertCommitOk(commitResult, 'commit basemap draft');
    const node = await core.nodes.get(commitResult.nodeId as NodeId);
    expect(node?.draftData).toBeUndefined();
    expect(node?.data).toEqual(draftPayload);
  });

  function uniqueName(base: string): string {
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it('creates and fetches a draft node by id', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('Draft Lookup') },
    });

    const byId = await draftService.getTreeNode(draft.id as NodeId);
    expect(byId?.id).toBe(draft.id);
    expect(byId?.draftData).toBeTruthy();
    expect(byId?.data).toBeNull();
  });

  it('commits a new draft and clears draftData', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('Draft Folder') },
    });

    const res = await draftService.commitDraft(draft.id);
    assertCommitOk(res, 'commitDraft');
    const committed = await core.nodes.get(res.nodeId);
    expect(committed?.draftData).toBeUndefined();
    expect(committed?.data).toBeTruthy();
    expect(committed?.version).toBe((draft.version ?? 1) + 1);
  });

  it('assigns depth relative to the parent when committing nested drafts', async () => {
    const rootId = 'r:root' as NodeId;
    const level1Draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId: rootId,
      metadata: { name: uniqueName('Depth L1') },
    });
    const level1Result = await draftService.commitDraft(level1Draft.id, {
      onNameConflict: 'auto-rename',
    });
    assertCommitOk(level1Result, 'level1 commit');

    const level1Node = await core.nodes.get(level1Result.nodeId as NodeId);
    expect(level1Node?.depth).toBe(1);

    const level2Draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId: level1Result.nodeId as NodeId,
      metadata: { name: uniqueName('Depth L2') },
    });
    const level2Result = await draftService.commitDraft(level2Draft.id, {
      onNameConflict: 'auto-rename',
    });
    assertCommitOk(level2Result, 'level2 commit');

    const level2Node = await core.nodes.get(level2Result.nodeId as NodeId);
    expect(level2Node?.depth).toBe((level1Node?.depth ?? 0) + 1);

    const reloadedParent = await core.nodes.get(level1Result.nodeId as NodeId);
    expect(reloadedParent?.depth).toBe(level1Node?.depth);
  });

  it('returns NAME_CONFLICT when policy is error', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Draft');

    const first = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    const firstResult = await draftService.commitDraft(first.id, { onNameConflict: 'auto-rename' });
    expect(firstResult.status).toBe('ok');

    const second = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    const conflict = await draftService.commitDraft(second.id, { onNameConflict: 'error' });
    assertCommitNameConflict(conflict, 'name conflict policy error');
    expect(conflict.suggestedName).toMatch(new RegExp(`^${baseName}`));

    const draftStillExists = await core.nodes.get(second.id);
    expect(draftStillExists).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('AutoRenameDraft');

    const draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });

    const res = await draftService.commitDraft(draft.id, { onNameConflict: 'auto-rename' });
    assertCommitOk(res, 'commitDraft auto-rename');
    expect(res.nodeId).not.toBe(draft.id);
    const node = await core.nodes.get(res.nodeId);
    expect(node?.metadata.name.startsWith(baseName)).toBe(true);
  });

  it('returns COMMIT_CONFLICT when version is outdated', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('VersionConflict') },
    });

    await core.nodes.update(draft.id as NodeId, { version: (draft.version ?? 0) + 1 });
    const res = await draftService.commitDraft(draft.id, { onNameConflict: 'error' });
    assertCommitConflict(res, 'commit conflict');
    expect(res.originalVersion).toBe((draft.version ?? 0) + 1);
  });

  it('rolls back committed node when TreeNodeUpdater commit fails (name conflict)', async () => {
    const parentId = 'r:root' as NodeId;

    const draft = await createDraftNode({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('RollbackDraft') },
    });

    const first = await draftService.commitDraft(draft.id);
    assertCommitOk(first, 'first commit');

    await core.nodes.update(first.nodeId, {
      metadata: { name: draft.metadata?.name ?? 'x', tags: [], description: '' },
      updatedAt: Date.now() as Timestamp,
    });

    const second = await draftService.commitDraft(first.nodeId, { onNameConflict: 'error' });
    assertCommitNameConflict(second, 'name conflict rollback');
    const after = await core.nodes.get(first.nodeId);
    expect(after?.metadata.name).toBe(draft.metadata?.name);
  });
});
