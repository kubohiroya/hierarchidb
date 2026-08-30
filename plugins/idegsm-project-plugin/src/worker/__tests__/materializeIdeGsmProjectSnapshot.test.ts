import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import { createIdeGsmProjectRootNodeData } from '@hierarchidb/idegsm-project-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it, vi } from 'vitest';
import type {
  IdeGsmProjectCoreDbPort,
  IdeGsmProjectSyncJournal,
} from '../ideGsmProjectMaterializationTypes.js';
import {
  buildMaterializedChildNodes,
  materializeIdeGsmProjectSnapshot,
} from '../materializeIdeGsmProjectSnapshot.js';

const now = Date.parse('2026-08-30T00:00:00.000Z');
const projectNodeId = toNodeId('project-root');

const createRoot = (version = 3): TreeNode => ({
  id: projectNodeId,
  parentId: toNodeId('parent'),
  nodeType: 'idegsm-project' as NodeType,
  depth: 1,
  createdAt: now - 1000,
  updatedAt: now - 1000,
  version,
  metadata: { name: 'Project', description: '', tags: [] },
  draftMetadata: null,
  data: createIdeGsmProjectRootNodeData({
    connectionName: 'local',
    projectRelativePath: 'project/a',
  }),
  visible: true,
});

class MemoryPort implements IdeGsmProjectCoreDbPort {
  readonly nodes = new Map<NodeId, TreeNode>();
  readonly journals: IdeGsmProjectSyncJournal[] = [];
  readonly events: string[] = [];

  constructor(root = createRoot()) {
    this.nodes.set(root.id, root);
  }

  async runInTx<T>(_mode: 'r' | 'rw', _tables: readonly ['nodes'], fn: () => Promise<T>) {
    this.events.push('tx:start');
    try {
      return await fn();
    } finally {
      this.events.push('tx:end');
    }
  }

  async getNode(nodeId: NodeId) {
    this.events.push(`get:${nodeId}`);
    return this.nodes.get(nodeId);
  }

  async putNode(node: TreeNode) {
    this.events.push(`putNode:${node.id}`);
    this.nodes.set(node.id, node);
  }

  async putNodes(nodes: readonly TreeNode[]) {
    this.events.push(`putNodes:${nodes.length}`);
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  async putJournal(journal: IdeGsmProjectSyncJournal) {
    this.events.push(`journal:${journal.state}`);
    this.journals.push(journal);
  }
}

describe('materializeIdeGsmProjectSnapshot', () => {
  it('writes children and switches the active generation in one transaction', async () => {
    const port = new MemoryPort();

    const result = await materializeIdeGsmProjectSnapshot(port, {
      operationId: 'op-1',
      generationId: 'gen-1',
      projectNodeId,
      expectedRootVersion: 3,
      now,
      snapshot: {
        connectionName: 'local',
        projectRelativePath: 'project/a',
        entries: [
          { relativePath: 'dir', kind: 'folder' },
          { relativePath: 'dir/config.yaml', kind: 'yaml-file', yamlContent: 'a: 1\n' },
          { relativePath: 'dir/table.csv', kind: 'csv-file', digest: 'sha256:csv' },
        ],
      },
    });

    expect(result.manifest).toMatchObject({ entryCount: 3, yamlCount: 1, csvCount: 1 });
    expect(port.events).toEqual([
      'journal:started',
      'tx:start',
      'get:project-root',
      'journal:validated',
      'putNodes:3',
      'putNode:project-root',
      'journal:committed',
      'tx:end',
    ]);
    expect(port.nodes.get(projectNodeId)?.data).toMatchObject({
      activeSyncGenerationId: 'gen-1',
      syncState: 'synced',
      syncedAt: new Date(now).toISOString(),
    });
  });

  it('materializes CSV nodes as metadata-only records', () => {
    const nodes = buildMaterializedChildNodes(
      {
        operationId: 'op-1',
        generationId: 'gen-1',
        projectNodeId,
        expectedRootVersion: 3,
        now,
        snapshot: {
          connectionName: 'local',
          projectRelativePath: 'project/a',
          entries: [{ relativePath: 'table.csv', kind: 'csv-file', digest: 'sha256:csv' }],
        },
      },
      1
    );

    const csvNode = nodes[0];
    expect(csvNode?.nodeType).toBe('spreadsheet');
    expect(csvNode?.depth).toBe(2);
    expect(csvNode?.data).toEqual({
      ideGsm: {
        projectNodeId: 'project-root',
        generationId: 'gen-1',
        relativePath: 'table.csv',
        kind: 'csv-file',
        digest: 'sha256:csv',
        sizeBytes: null,
        updatedAt: null,
      },
    });
    expect(JSON.stringify(csvNode)).not.toContain('content');
    expect(JSON.stringify(csvNode)).not.toContain('rawBody');
  });

  it('fails closed and records a reverted journal on version conflict', async () => {
    const port = new MemoryPort(createRoot(2));

    await expect(
      materializeIdeGsmProjectSnapshot(port, {
        operationId: 'op-1',
        generationId: 'gen-1',
        projectNodeId,
        expectedRootVersion: 3,
        now,
        snapshot: {
          connectionName: 'local',
          projectRelativePath: 'project/a',
          entries: [{ relativePath: 'dir', kind: 'folder' }],
        },
      })
    ).rejects.toThrow('IDEGSM_PROJECT_ROOT_VERSION_CONFLICT');

    expect(port.journals.map((journal) => journal.state)).toEqual(['started', 'reverted']);
    expect(port.journals[1]?.error).toBe('IDEGSM_PROJECT_ROOT_VERSION_CONFLICT');
    expect(port.nodes.get(projectNodeId)?.data).toMatchObject({
      activeSyncGenerationId: null,
      syncState: 'not-synced',
    });
  });

  it('rejects snapshots with missing folder parents', () => {
    expect(() =>
      buildMaterializedChildNodes(
        {
          operationId: 'op-1',
          generationId: 'gen-1',
          projectNodeId,
          expectedRootVersion: 3,
          now,
          snapshot: {
            connectionName: 'local',
            projectRelativePath: 'project/a',
            entries: [{ relativePath: 'missing/file.yaml', kind: 'yaml-file', yamlContent: '' }],
          },
        },
        1
      )
    ).toThrow('IDEGSM_PROJECT_PARENT_MISSING');
  });

  it('does not write partial children when validation fails before putNodes', async () => {
    const port = new MemoryPort({
      ...createRoot(),
      data: {
        ...createIdeGsmProjectRootNodeData({
          connectionName: 'other',
          projectRelativePath: 'project/a',
        }),
      },
    });
    const putNodes = vi.spyOn(port, 'putNodes');

    await expect(
      materializeIdeGsmProjectSnapshot(port, {
        operationId: 'op-1',
        generationId: 'gen-1',
        projectNodeId,
        expectedRootVersion: 3,
        now,
        snapshot: {
          connectionName: 'local',
          projectRelativePath: 'project/a',
          entries: [{ relativePath: 'dir', kind: 'folder' }],
        },
      })
    ).rejects.toThrow('IDEGSM_PROJECT_IDENTITY_CONFLICT');

    expect(putNodes).not.toHaveBeenCalled();
    expect(port.journals.map((journal) => journal.state)).toEqual(['started', 'reverted']);
  });
});
