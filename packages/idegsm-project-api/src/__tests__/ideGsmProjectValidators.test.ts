import { toNodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  assertIdeGsmProjectChildMetadata,
  assertIdeGsmProjectRootNodeData,
  createIdeGsmProjectChildMetadata,
  createIdeGsmProjectDirectoryRequest,
  createIdeGsmProjectRootNodeData,
  createIdeGsmProjectSnapshotManifest,
  createTrackedIdeGsmProjectChildMetadata,
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

  it('keeps CSV child metadata metadata-only until tabular content is tracked', () => {
    const child = createIdeGsmProjectChildMetadata({
      projectNodeId: toNodeId('project-node'),
      generationId: 'gen-1',
      relativePath: 'runs/table.csv',
      kind: 'csv-file',
      digest: 'sha256:abc',
    });

    expect(child.tabularContent).toEqual({ policy: 'metadata-only' });
    assertIdeGsmProjectChildMetadata(child);

    const tracked = createTrackedIdeGsmProjectChildMetadata(child, {
      snapshotId: 'snapshot-1',
      contentGenerationId: 'content-gen-1',
      digest: 'sha256:def',
      sizeBytes: 42,
      updatedAt: '2026-08-30T00:00:00Z',
    });

    expect(tracked.tabularContent).toEqual({
      policy: 'tracked',
      snapshotId: 'snapshot-1',
      contentGenerationId: 'content-gen-1',
    });
    expect(tracked.digest).toBe('sha256:def');
    expect(tracked.sizeBytes).toBe(42);
    assertIdeGsmProjectChildMetadata(tracked);
  });

  it('rejects missing or misplaced tabularContent metadata', () => {
    const csvChild = createIdeGsmProjectChildMetadata({
      projectNodeId: toNodeId('project-node'),
      generationId: 'gen-1',
      relativePath: 'runs/table.csv',
      kind: 'csv-file',
    });
    const yamlChild = createIdeGsmProjectChildMetadata({
      projectNodeId: toNodeId('project-node'),
      generationId: 'gen-1',
      relativePath: 'config/app.yaml',
      kind: 'yaml-file',
    });

    expect(() =>
      assertIdeGsmProjectChildMetadata({
        ...csvChild,
        tabularContent: undefined,
      })
    ).toThrow('tabularContent');
    expect(() =>
      assertIdeGsmProjectChildMetadata({
        ...yamlChild,
        tabularContent: { policy: 'metadata-only' },
      })
    ).toThrow('csv-file');
  });

  it('builds a complete snapshot manifest and keeps CSV entries metadata-only', () => {
    const manifest = createIdeGsmProjectSnapshotManifest({
      connectionName: 'local',
      projectRelativePath: 'project/a',
      entries: [
        { relativePath: 'dir', kind: 'folder' },
        { relativePath: 'dir/config.yaml', kind: 'yaml-file', yamlContent: 'a: 1\n' },
        { relativePath: 'dir/table.csv', kind: 'csv-file', digest: 'sha256:abc' },
      ],
    });

    expect(manifest).toEqual({
      connectionName: 'local',
      projectRelativePath: 'project/a',
      entryCount: 3,
      yamlCount: 1,
      csvCount: 1,
      folderCount: 1,
    });
    expect(() =>
      createIdeGsmProjectSnapshotManifest({
        connectionName: 'local',
        projectRelativePath: 'project/a',
        entries: [
          {
            relativePath: 'dir/table.csv',
            kind: 'csv-file',
            yamlContent: 'raw,csv\n',
          },
        ],
      })
    ).toThrow('yamlContent');
  });
});
