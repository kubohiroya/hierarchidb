import { toNodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  assertIdeGsmProjectChildMetadata,
  assertIdeGsmProjectRootNodeData,
  createIdeGsmProjectChildMetadata,
  createIdeGsmProjectDirectoryRequest,
  createIdeGsmProjectRootNodeData,
  sameIdeGsmProjectIdentity,
} from '../index.js';

describe('IDE-GSM project contracts', () => {
  it('creates version 1 root data from compound identity only', () => {
    const data = createIdeGsmProjectRootNodeData({
      connectionName: 'local',
      projectRelativePath: 'projects/sample',
    });

    expect(data).toEqual({
      version: 1,
      connectionName: 'local',
      projectRelativePath: 'projects/sample',
      activeSyncGenerationId: null,
      syncState: 'not-synced',
      syncedAt: null,
    });
    assertIdeGsmProjectRootNodeData(data);
  });

  it('compares project identity by connectionName and projectRelativePath', () => {
    expect(
      sameIdeGsmProjectIdentity(
        { connectionName: 'local', projectRelativePath: 'a' },
        { connectionName: 'local', projectRelativePath: 'a' }
      )
    ).toBe(true);
    expect(
      sameIdeGsmProjectIdentity(
        { connectionName: 'local', projectRelativePath: 'a' },
        { connectionName: 'remote', projectRelativePath: 'a' }
      )
    ).toBe(false);
  });

  it.each(['mountKind', 'mountId', 'sourceKind', 'projectId', 'endpoint', 'credentials', 'body'])(
    'rejects legacy or non-persistable root field %s',
    (field) => {
      expect(() =>
        assertIdeGsmProjectRootNodeData({
          version: 1,
          connectionName: 'local',
          projectRelativePath: 'projects/sample',
          activeSyncGenerationId: null,
          syncState: 'not-synced',
          syncedAt: null,
          [field]: 'forbidden',
        })
      ).toThrow(field);
    }
  );

  it('rejects absolute paths and parent traversal', () => {
    expect(() =>
      createIdeGsmProjectRootNodeData({
        connectionName: 'local',
        projectRelativePath: '/tmp/project',
      })
    ).toThrow('projectRelativePath');
    expect(() =>
      createIdeGsmProjectDirectoryRequest(
        { connectionName: 'local', projectRelativePath: 'projects/sample' },
        '../outside'
      )
    ).toThrow('path');
  });

  it('validates child metadata without legacy mount fields', () => {
    const child = createIdeGsmProjectChildMetadata({
      projectNodeId: toNodeId('project-node'),
      generationId: 'gen-1',
      relativePath: 'config/app.yaml',
      kind: 'yaml-file',
      digest: 'sha256:abc',
    });

    expect(child.projectNodeId).toBe('project-node');
    assertIdeGsmProjectChildMetadata(child);
    expect(() =>
      assertIdeGsmProjectChildMetadata({
        ...child,
        mountId: 'legacy',
      })
    ).toThrow('mountId');
  });
});
