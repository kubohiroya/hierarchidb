import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import type {
  ConditionalProjectYamlWriteInput,
  ConditionalProjectYamlWriteResult,
  ProjectYamlFileContent,
} from '@hierarchidb/ide-gsm-client';
import {
  createIdeGsmProjectChildMetadata,
  createIdeGsmProjectRootNodeData,
} from '@hierarchidb/idegsm-project-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it, vi } from 'vitest';
import type {
  IdeGsmProjectYamlClient,
  IdeGsmProjectYamlWriteCoreDbPort,
  IdeGsmProjectYamlWriteRuntimePort,
} from '../conditionalIdeGsmProjectYamlWriteTypes.js';
import { writeConnectedIdeGsmProjectYaml } from '../writeConnectedIdeGsmProjectYaml.js';

const now = Date.parse('2026-08-30T00:00:00.000Z');
const projectNodeId = toNodeId('project-root');
const yamlNodeId = toNodeId('yaml-node');
const oldDigest = '0'.repeat(64);
const newDigest = '1'.repeat(64);
const projectRelativePath = 'group/project';
const relativePath = 'scenarios/base.yaml';

const draftData = {
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
  content: 'name: next\n',
} as const;

function createProjectRoot(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: projectNodeId,
    parentId: toNodeId('parent'),
    nodeType: 'idegsm-project' as NodeType,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 4,
    metadata: { name: 'Project', description: '', tags: [] },
    draftMetadata: null,
    data: {
      ...createIdeGsmProjectRootNodeData({
        connectionName: 'local',
        projectRelativePath,
      }),
      activeSyncGenerationId: 'gen-1',
      syncState: 'synced',
      syncedAt: '2026-08-30T00:00:00Z',
    },
    visible: true,
    hasChildren: true,
    ...overrides,
  };
}

function createYamlNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: yamlNodeId,
    parentId: projectNodeId,
    nodeType: 'yaml-file' as NodeType,
    depth: 2,
    createdAt: now,
    updatedAt: now,
    version: 2,
    metadata: { name: 'base.yaml', description: '', tags: [] },
    draftMetadata: null,
    data: {
      name: 'base.yaml',
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      content: 'name: old\n',
      ideGsm: createIdeGsmProjectChildMetadata({
        projectNodeId,
        generationId: 'gen-1',
        relativePath,
        kind: 'yaml-file',
        digest: oldDigest,
        sizeBytes: 10,
        updatedAt: '2026-08-30T00:00:00Z',
      }),
    },
    visible: true,
    hasChildren: false,
    ...overrides,
  };
}

class MemoryCoreDb implements IdeGsmProjectYamlWriteCoreDbPort {
  readonly nodes = new Map<NodeId, TreeNode>();

  constructor(nodes: readonly TreeNode[] = [createProjectRoot(), createYamlNode()]) {
    for (const node of nodes) this.nodes.set(node.id, node);
  }

  async runInTx<T>(_mode: 'r' | 'rw', _tables: readonly ['nodes'], fn: () => Promise<T>) {
    return fn();
  }

  async getNode(nodeId: NodeId) {
    return this.nodes.get(nodeId);
  }

  async putNode(node: TreeNode) {
    this.nodes.set(node.id, node);
  }
}

function createClient(
  options: Partial<{
    writeResult: ConditionalProjectYamlWriteResult;
    reread: ProjectYamlFileContent;
    failWrite: boolean;
    failReread: boolean;
  }> = {}
): IdeGsmProjectYamlClient {
  return {
    conditionalProjectYamlWrite: vi.fn(async (_input: ConditionalProjectYamlWriteInput) => {
      if (options.failWrite) throw new Error('secret write failure');
      return (
        options.writeResult ?? {
          status: 'UPDATED',
          projectRelativePath,
          relativePath,
          contentDigest: newDigest,
          updatedAt: '2026-08-30T00:00:01Z',
          byteCount: 11,
          resyncRequired: false,
        }
      );
    }),
    projectYamlFileContent: vi.fn(async () => {
      if (options.failReread) throw new Error('secret reread failure');
      return (
        options.reread ?? {
          projectRelativePath,
          relativePath,
          content: draftData.content,
          contentDigest: newDigest,
          updatedAt: '2026-08-30T00:00:01Z',
          byteCount: 11,
        }
      );
    }),
  };
}

function createRuntime(client: IdeGsmProjectYamlClient | null): IdeGsmProjectYamlWriteRuntimePort {
  return {
    resolveClient: vi.fn(async () => client),
  };
}

describe('writeConnectedIdeGsmProjectYaml', () => {
  it('writes server-first, rereads, and reflects only authoritative content locally', async () => {
    const coreDb = new MemoryCoreDb();
    const client = createClient();

    const result = await writeConnectedIdeGsmProjectYaml(coreDb, createRuntime(client), {
      nodeId: yamlNodeId,
      expectedNodeVersion: 2,
      expectedDigest: oldDigest,
      draftData,
    });

    expect(result.ok).toBe(true);
    expect(client.conditionalProjectYamlWrite).toHaveBeenCalledWith({
      projectRelativePath,
      relativePath,
      expectedDigest: oldDigest,
      content: draftData.content,
    });
    expect(client.projectYamlFileContent).toHaveBeenCalledWith({
      projectRelativePath,
      relativePath,
    });
    expect(coreDb.nodes.get(yamlNodeId)?.data).toMatchObject({
      content: draftData.content,
      ideGsm: { digest: newDigest, sizeBytes: 11, updatedAt: '2026-08-30T00:00:01Z' },
    });
  });

  it('returns CONTENT_CONFLICT and leaves local content unchanged', async () => {
    const coreDb = new MemoryCoreDb();
    const client = createClient({
      writeResult: {
        status: 'CONTENT_CONFLICT',
        projectRelativePath,
        relativePath,
        contentDigest: newDigest,
        updatedAt: '2026-08-30T00:00:01Z',
        byteCount: 12,
        resyncRequired: false,
      },
    });

    const result = await writeConnectedIdeGsmProjectYaml(coreDb, createRuntime(client), {
      nodeId: yamlNodeId,
      expectedNodeVersion: 2,
      expectedDigest: oldDigest,
      draftData,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'CONTENT_CONFLICT',
        currentDigest: newDigest,
        updatedAt: '2026-08-30T00:00:01Z',
      },
    });
    expect(client.projectYamlFileContent).not.toHaveBeenCalled();
    expect(coreDb.nodes.get(yamlNodeId)?.data).toMatchObject({ content: 'name: old\n' });
  });

  it('blocks disconnected, missing, stale, and unsynchronized nodes before server write', async () => {
    const client = createClient();
    await expect(
      writeConnectedIdeGsmProjectYaml(new MemoryCoreDb(), createRuntime(null), {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: oldDigest,
        draftData,
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'DISCONNECTED' } });
    await expect(
      writeConnectedIdeGsmProjectYaml(new MemoryCoreDb([]), createRuntime(client), {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: oldDigest,
        draftData,
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'NODE_MISSING' } });
    await expect(
      writeConnectedIdeGsmProjectYaml(new MemoryCoreDb(), createRuntime(client), {
        nodeId: yamlNodeId,
        expectedNodeVersion: 1,
        expectedDigest: oldDigest,
        draftData,
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'NODE_STALE' } });
    await expect(
      writeConnectedIdeGsmProjectYaml(
        new MemoryCoreDb([
          createProjectRoot({ data: { ...createProjectRoot().data, syncState: 'stale' } }),
          createYamlNode(),
        ]),
        createRuntime(client),
        {
          nodeId: yamlNodeId,
          expectedNodeVersion: 2,
          expectedDigest: oldDigest,
          draftData,
        }
      )
    ).resolves.toMatchObject({ ok: false, error: { code: 'NODE_NOT_SYNCED' } });
    expect(client.conditionalProjectYamlWrite).not.toHaveBeenCalled();
  });

  it('requires the local expectedDigest to match the synchronized digest', async () => {
    const client = createClient();

    await expect(
      writeConnectedIdeGsmProjectYaml(new MemoryCoreDb(), createRuntime(client), {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: '',
        draftData,
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'EXPECTED_DIGEST_REQUIRED' } });
    await expect(
      writeConnectedIdeGsmProjectYaml(new MemoryCoreDb(), createRuntime(client), {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: newDigest,
        draftData,
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'NODE_STALE' } });
    expect(client.conditionalProjectYamlWrite).not.toHaveBeenCalled();
  });

  it('maps auth and reread failures without applying local reflection', async () => {
    const authCoreDb = new MemoryCoreDb();
    const authResult = await writeConnectedIdeGsmProjectYaml(
      authCoreDb,
      createRuntime(
        createClient({
          writeResult: {
            status: 'AUTHORIZATION_FAILED',
            projectRelativePath,
            relativePath,
            contentDigest: null,
            updatedAt: null,
            byteCount: null,
            resyncRequired: false,
          },
        })
      ),
      {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: oldDigest,
        draftData,
      }
    );

    const rereadCoreDb = new MemoryCoreDb();
    const rereadResult = await writeConnectedIdeGsmProjectYaml(
      rereadCoreDb,
      createRuntime(createClient({ failReread: true })),
      {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: oldDigest,
        draftData,
      }
    );

    expect(authResult).toMatchObject({ ok: false, error: { code: 'AUTHORIZATION_FAILED' } });
    expect(rereadResult).toMatchObject({ ok: false, error: { code: 'REREAD_FAILED' } });
    expect(authCoreDb.nodes.get(yamlNodeId)?.data).toMatchObject({ content: 'name: old\n' });
    expect(rereadCoreDb.nodes.get(yamlNodeId)?.data).toMatchObject({ content: 'name: old\n' });
  });

  it('rejects reread mismatches and does not overwrite local state', async () => {
    const coreDb = new MemoryCoreDb();
    const result = await writeConnectedIdeGsmProjectYaml(
      coreDb,
      createRuntime(
        createClient({
          reread: {
            projectRelativePath,
            relativePath,
            content: 'name: other\n',
            contentDigest: newDigest,
            updatedAt: '2026-08-30T00:00:01Z',
            byteCount: 12,
          },
        })
      ),
      {
        nodeId: yamlNodeId,
        expectedNodeVersion: 2,
        expectedDigest: oldDigest,
        draftData,
      }
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'REREAD_MISMATCH' } });
    expect(coreDb.nodes.get(yamlNodeId)?.data).toMatchObject({ content: 'name: old\n' });
  });
});
