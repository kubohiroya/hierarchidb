import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeNode, TreeNodeMetadata } from '@hierarchidb/common-types';
import { makeNode } from '../../test-utils/node-helpers.js';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';
import { WorkerErrorCode } from '../../services/command-types.js';
import { DraftService } from '../../services/DraftService.js';
import {
  assertCommandFailure,
  assertCommandSuccess,
  assertCommitConflict,
  assertCommitNameConflict,
  assertCommitOk,
} from '../../test-utils/assertions.js';

describe('Draft commit E2E (holder-less)', () => {
  let core: CoreDB;
  let cp: CommandProcessor;
  let wc: DraftService;

  beforeEach(async () => {
    core = await CoreDB.getSingleton('e2e-db');
    cp = new CommandProcessor(core);
    wc = new DraftService(core, undefined, cp);
  });

  async function createWorkingCopy(params: {
    nodeType: NodeType;
    parentId: NodeId;
    metadata?: Partial<TreeNodeMetadata>;
    draftData?: Record<string, unknown>;
  }): Promise<TreeNode> {
    const wcNode = await wc.initTreeNode(params.nodeType, params.parentId, {
      metadata: params.metadata as TreeNode['metadata'],
      draftData: params.draftData as TreeNode['draftData'],
    } as Partial<TreeNode>);
    if (params.metadata) {
      await wc.updateTreeNodeDraftMetadata(wcNode.id as NodeId, params.metadata);
    }
    if (params.draftData) {
      await wc.updateTreeNodeDraftData(wcNode.id as NodeId, params.draftData);
    }
    const reloaded = await core.nodes.get(wcNode.id as NodeId);
    if (!reloaded) throw new Error('working copy not found');
    return reloaded as TreeNode;
  }

  it('preserves draftData content when committing a non-folder node (basemap)', async () => {
    const parentId = 'r:root' as NodeId;
    const draftPayload = {
      mapStyle: { style: 'streets' },
      viewport: { center: [0, 0] as [number, number], zoom: 2, bearing: 0, pitch: 0 },
    };

    const draft = await createWorkingCopy({
      nodeType: 'basemap' as NodeType,
      parentId,
      metadata: { name: uniqueName('Basemap') },
      draftData: draftPayload,
    });

    const commitResult = await wc.commitDraft(draft.id);
    assertCommitOk(commitResult, 'commit basemap draft');
    const node = await core.nodes.get(commitResult.nodeId as NodeId);
    expect(node?.draftData).toBeNull();
    expect(node?.data).toEqual(draftPayload);
  });

  function uniqueName(base: string): string {
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it('creates and fetches a draft working copy by id', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('Draft Lookup') },
    });

    const byId = await wc.getTreeNode(draft.id as NodeId);
    expect(byId?.id).toBe(draft.id);
    expect(byId?.draftData).toBeTruthy();
    expect(byId?.data).toBeNull();
  });

  it('commits a new draft and clears draftData', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: uniqueName('Draft Folder') },
    });

    const res = await wc.commitDraft(draft.id);
    assertCommitOk(res, 'commitDraft');
    const committed = await core.nodes.get(res.nodeId);
    expect(committed?.draftData).toBeNull();
    expect(committed?.data).toBeTruthy();
    expect(committed?.version).toBe((draft.version ?? 1) + 1);
  });

  it('assigns depth relative to the parent when committing nested drafts', async () => {
    const rootId = 'r:root' as NodeId;
    const level1Draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId: rootId,
      metadata: { name: uniqueName('Depth L1') },
    });
    const level1Result = await wc.commitDraft(level1Draft.id, {
      onNameConflict: 'auto-rename',
    });
    assertCommitOk(level1Result, 'level1 commit');

    const level1Node = await core.nodes.get(level1Result.nodeId as NodeId);
    expect(level1Node?.depth).toBe(1);

    const level2Draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId: level1Result.nodeId as NodeId,
      metadata: { name: uniqueName('Depth L2') },
    });
    const level2Result = await wc.commitDraft(level2Draft.id, {
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

    const first = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    const firstResult = await wc.commitDraft(first.id, { onNameConflict: 'auto-rename' });
    expect(firstResult.status).toBe('ok');

    const second = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    const conflict = await wc.commitDraft(second.id, { onNameConflict: 'error' });
    assertCommitNameConflict(conflict, 'name conflict policy error');
    expect(conflict.suggestedName).toMatch(new RegExp(`^${baseName}`));

    const draftStillExists = await core.nodes.get(second.id);
    expect(draftStillExists).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Auto Rename');

    const first = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    const firstRes = await wc.commitDraft(first.id);
    assertCommitOk(firstRes, 'first commit');

    const committedFirst = await core.nodes.get(firstRes.nodeId);
    expect(committedFirst?.metadata.name).toBe(baseName);

    const second = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });

    const res = await wc.commitDraft(second.id, { onNameConflict: 'auto-rename' });
    assertCommitOk(res, 'second commit');
    expect(res.autoRenameTo).toBeTruthy();

    const stored = await core.nodes.get(res.nodeId);
    expect(stored?.metadata.name).toBe(res.autoRenameTo);
  });

  it('returns COMMIT_CONFLICT when canonical node version advances', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Edit');

    const draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName, description: '', tags: [] },
    });
    const commitResult = await wc.commitDraft(draft.id);
    assertCommitOk(commitResult, 'initial commit');
    const canonicalId = commitResult.nodeId as NodeId;

    const canonical = await core.nodes.get(canonicalId);
    if (!canonical) throw new Error('Canonical node not found');
    await wc.updateTreeNodeDraftMetadata(canonicalId, canonical.metadata ?? {});
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const conflict = await wc.commitDraft(canonicalId, {
      onNameConflict: 'auto-rename',
    });
    assertCommitConflict(conflict, 'worker commit conflict');
    expect(conflict.originalVersion).toBeGreaterThan(conflict.wcVersion ?? 0);
  });

  it('CommandProcessor surfaces NAME_CONFLICT metadata', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('CP Conflict');

    const draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName },
    });
    await wc.commitDraft(draft.id);

    const second = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName, description: '', tags: [] },
    });

    const envelope = cp.createEnvelope('commitDraft', {
      draftId: second.id,
      onNameConflict: 'error',
    });
    const result = await cp.processCommand(envelope);
    assertCommandFailure(result, 'cp NAME_CONFLICT');
    expect(result.code).toBe(WorkerErrorCode.VALIDATION_ERROR);
    expect(result.status).toBe('NAME_CONFLICT');
    expect(result.suggestedName).toBeTruthy();
  });

  it('CommandProcessor emits COMMIT_CONFLICT details', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('CP Commit Conflict');

    const draft = await createWorkingCopy({
      nodeType: 'folder' as NodeType,
      parentId,
      metadata: { name: baseName, description: '', tags: [] },
    });
    const commitResult = await wc.commitDraft(draft.id);
    assertCommitOk(commitResult, 'initial commit');
    const canonicalId = commitResult.nodeId as NodeId;

    const canonical = await core.nodes.get(canonicalId);
    if (!canonical) throw new Error('Canonical node not found');
    await wc.updateTreeNodeDraftMetadata(canonicalId, canonical.metadata ?? {});
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const envelope = cp.createEnvelope('commitDraft', {
      draftId: canonicalId,
      onNameConflict: 'auto-rename',
    });
    const result = await cp.processCommand(envelope);
    expect(result.status).toBe('COMMIT_CONFLICT');
    if (result.status !== 'COMMIT_CONFLICT') {
      throw new Error('Expected commit conflict');
    }
    expect(result.originalVersion).toBeGreaterThan(result.wcVersion ?? 0);
  });
});
