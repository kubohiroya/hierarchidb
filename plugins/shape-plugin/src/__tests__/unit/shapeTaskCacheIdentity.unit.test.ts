import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  buildGeometryTaskCacheIdentity,
  buildSourceTaskCacheIdentity,
  buildTileEmitTaskCacheIdentity,
  resolveTaskCacheIdentity,
  ShapeTaskCacheIdentityContractError,
} from '../../services/vt/shapeTaskCacheIdentity';

const NODE_ID = 'node-1' as NodeId;

const buildPersistedTask = (
  inputData: unknown,
  stage: TaskQueueRecord['stage'] = 'source'
): TaskQueueRecord => ({
  taskId: 'task-1',
  nodeId: NODE_ID,
  stage,
  status: 'queued',
  index: 0,
  progress: 0,
  inputData,
});

describe('shapeTaskCacheIdentity', () => {
  it('uses namespace policy to switch source key space', () => {
    const nodeScoped = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { source: 'node' },
    });
    const globalScoped = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { source: 'global' },
    });
    expect(nodeScoped.cacheKey).toContain('node:node-1:shape:source');
    expect(globalScoped.cacheKey).toContain('global:shape:source');
  });

  it('changes source identity when source key or request signature changes', () => {
    const first = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a?version=1',
      configSignature: 'sig-1',
    });
    const second = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:1',
      url: 'https://example.com/a?version=2',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).not.toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('changes source inputHash when upstreamRevision changes', () => {
    const first = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v1',
      configSignature: 'sig-1',
    });
    const second = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v2',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('changes source inputHash when output shaping config changes', () => {
    const first = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
    });
    const second = buildSourceTaskCacheIdentity({
      nodeId: NODE_ID,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-2',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it.each([
    ['dataSource', { dataSource: '' as never }],
    ['dataSource', { dataSource: 'unknown' as never }],
    ['sourceKey', { sourceKey: 'unknown:0' }],
    ['sourceKey', { sourceKey: 'jp:0' }],
    ['url', { url: '' }],
    ['url', { url: 'relative/path' }],
    ['configSignature', { configSignature: '' }],
    ['upstreamRevision', { upstreamRevision: '' }],
  ])('rejects an invalid source %s without a fallback', (field, overrides) => {
    expect(() =>
      buildSourceTaskCacheIdentity({
        nodeId: NODE_ID,
        dataSource: 'gadm',
        sourceKey: 'JP:0',
        url: 'https://example.com/a',
        configSignature: 'sig-1',
        ...overrides,
      })
    ).toThrowError(ShapeTaskCacheIdentityContractError);
    expect(() =>
      buildSourceTaskCacheIdentity({
        nodeId: NODE_ID,
        dataSource: 'gadm',
        sourceKey: 'JP:0',
        url: 'https://example.com/a',
        configSignature: 'sig-1',
        ...overrides,
      })
    ).toThrow(field);
  });

  it('changes geometry inputHash when artifact or tolerance changes', () => {
    const first = buildGeometryTaskCacheIdentity({
      nodeId: NODE_ID,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      sourceBaseTolerance: 0.125,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildGeometryTaskCacheIdentity({
      nodeId: NODE_ID,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:b',
      sourceBaseTolerance: 0.25,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it.each([
    ['sourceKey', { sourceKey: 'unknown:0' }],
    ['bandIndex', { bandIndex: 1.5 }],
    ['sourceArtifactHash', { sourceArtifactHash: '' }],
    ['sourceBaseTolerance', { sourceBaseTolerance: Number.NaN }],
    ['sourceBaseTolerance', { sourceBaseTolerance: -1 }],
    ['bandMinZoom/bandMaxZoom', { bandMinZoom: 9, bandMaxZoom: 8 }],
    ['configSignature', { configSignature: '' }],
  ])('rejects an invalid geometry %s without rounding or defaults', (field, overrides) => {
    expect(() =>
      buildGeometryTaskCacheIdentity({
        nodeId: NODE_ID,
        sourceKey: 'JP:0',
        bandIndex: 2,
        sourceArtifactHash: 'artifact:a',
        sourceBaseTolerance: 0.125,
        bandMinZoom: 6,
        bandMaxZoom: 8,
        configSignature: 'sig-1',
        ...overrides,
      })
    ).toThrow(field);
  });

  it('canonicalizes a valid tileEmit buffer set for a stable inputHash', () => {
    const first = buildTileEmitTaskCacheIdentity({
      nodeId: NODE_ID,
      bandIndex: 3,
      zBase: 6,
      tileId: 123,
      bufferIds: ['b', 'a', 'a'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildTileEmitTaskCacheIdentity({
      nodeId: NODE_ID,
      bandIndex: 3,
      zBase: 6,
      tileId: 123,
      bufferIds: ['a', 'b'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.inputHash).toEqual(second.inputHash);
  });

  it('separates node-scoped geometry and tileEmit identities by node', () => {
    const geometryFirst = buildGeometryTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      sourceBaseTolerance: 0.125,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const geometrySecond = buildGeometryTaskCacheIdentity({
      nodeId: 'node-2' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      sourceBaseTolerance: 0.125,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const tileFirst = buildTileEmitTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      bandIndex: 2,
      zBase: 6,
      tileId: 123,
      bufferIds: ['a'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const tileSecond = buildTileEmitTaskCacheIdentity({
      nodeId: 'node-2' as NodeId,
      bandIndex: 2,
      zBase: 6,
      tileId: 123,
      bufferIds: ['a'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });

    expect(geometryFirst.cacheKey).not.toEqual(geometrySecond.cacheKey);
    expect(tileFirst.cacheKey).not.toEqual(tileSecond.cacheKey);
  });

  it('accepts an explicitly present empty tileEmit buffer set', () => {
    expect(
      buildTileEmitTaskCacheIdentity({
        nodeId: NODE_ID,
        bandIndex: 0,
        zBase: 0,
        tileId: 0,
        bufferIds: [],
        bandMinZoom: 0,
        bandMaxZoom: 2,
        configSignature: 'sig-1',
      }).inputHash
    ).toContain('transformArtifactSet');
  });

  it.each([
    ['bandIndex', { bandIndex: -1 }],
    ['zBase', { zBase: 1.5 }],
    ['tileId', { tileId: Number.POSITIVE_INFINITY }],
    ['bufferIds', { bufferIds: undefined as unknown as string[] }],
    ['bufferIds[0]', { bufferIds: [''] }],
    ['zBase', { zBase: 9 }],
    ['configSignature', { configSignature: '' }],
  ])('rejects an invalid tileEmit %s without filtering or defaults', (field, overrides) => {
    expect(() =>
      buildTileEmitTaskCacheIdentity({
        nodeId: NODE_ID,
        bandIndex: 3,
        zBase: 6,
        tileId: 123,
        bufferIds: ['a'],
        bandMinZoom: 6,
        bandMaxZoom: 8,
        configSignature: 'sig-1',
        ...overrides,
      })
    ).toThrow(field);
  });

  it('reads only a complete persisted cacheKey/inputHash pair', () => {
    const identity = resolveTaskCacheIdentity(
      buildPersistedTask({
        cacheKey: 'persisted-key',
        inputHash: 'persisted-hash',
      })
    );
    expect(identity).toEqual({
      cacheKey: 'persisted-key',
      inputHash: 'persisted-hash',
    });
  });

  it.each([
    undefined,
    {},
    { cacheKey: 'persisted-key' },
    { inputHash: 'persisted-hash' },
    { cacheKey: '', inputHash: 'persisted-hash' },
    { cacheKey: 'persisted-key', inputHash: '' },
  ])('rejects missing or partial persisted identity without reconstructing it', (inputData) => {
    expect(() => resolveTaskCacheIdentity(buildPersistedTask(inputData))).toThrowError(
      ShapeTaskCacheIdentityContractError
    );
  });

  it('rejects an unknown stage even when persisted identity is complete', () => {
    expect(() =>
      resolveTaskCacheIdentity(
        buildPersistedTask(
          { cacheKey: 'persisted-key', inputHash: 'persisted-hash' },
          'legacy' as TaskQueueRecord['stage']
        )
      )
    ).toThrow('stage');
  });

  it('does not expose a rejected source URL in the contract error', () => {
    const secretUrl = 'secret-token';
    expect(() =>
      buildSourceTaskCacheIdentity({
        nodeId: NODE_ID,
        dataSource: 'gadm',
        sourceKey: 'JP:0',
        url: secretUrl,
        configSignature: 'sig-1',
      })
    ).toThrow('url must be an absolute URL');
    try {
      buildSourceTaskCacheIdentity({
        nodeId: NODE_ID,
        dataSource: 'gadm',
        sourceKey: 'JP:0',
        url: secretUrl,
        configSignature: 'sig-1',
      });
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toContain(secretUrl);
    }
  });
});
